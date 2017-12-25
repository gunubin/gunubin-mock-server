/* @flow */
import express from 'express';
import _ from 'lodash';
import chalk from 'chalk';
import $RefParser from 'json-schema-ref-parser';
import jsf from 'json-schema-faker';
import Ajv from 'ajv';
import glob from 'glob';
import path from 'path';

type Params = {
  glob: string,
  port: number
}

type Sample = any

type ResponseType = (
  request: Object,
  sample: Object
) => Object | Object

type Stub = {
  override: boolean,
  response: ResponseType,
}

const STATUS_SUCCESS = 200;
const STATUS_ERROR = 400;

/**
 * GunubinMockServer
 */
export default class GunubinMockServer {
  _ajv: Ajv;
  _callback: () => void;
  _instance: any;
  _resources: {[key: string]: Stub} = {};
  _routing: {[key: string]: Stub} = {};
  _params: Params;
  app: any;
  globalValidResponseSchemata: Object[] = [];
  jsf: jsf;
  parser: $RefParser;
  schemata: Object = {};// パース済みのproperties以下を保持する

  /**
   * constructor
   *
   * @param jsf - json-schema-faker
   */
  constructor() {
    this.jsf = jsf;
    this.app = express();
    this.parser = new $RefParser();
    this._ajv = new Ajv();
  }

  /**
   * JSON Schemaファイルを読み込みます。
   *
   * @private
   */
  async _readSchema() {
    return new Promise((resolve) => {
      glob(path.join(this._params.glob), {nonull: true}, (err, files) => {
        const promises = [];
        files.map(file => {
          const promise = new Promise(resolve => {
            $RefParser.dereference(file, (err, schema) => {
              this.log('find schema file:', chalk.green(file));
              if (err) {
                this.log(err);
              }
              this._generateEndPoints(schema);
              resolve();
            });
          });
          promises.push(promise);
        });
        Promise.all(promises).then(() => resolve());
      });
    });
  }

  /**
   * JSONSchemaのlink.hrefプロパティからルーティング用のpathを返します。
   *
   * @param href - JSONSchemaのlink.href
   * @returns {string}
   * @private
   *
   * FIXME: schemaからパラメータ名を取得できないので一旦"param{index}"を返す
   */
  _getPath(href: string) {
    let ret = href;
    const regexp = /\{\(.*\)\}/g;
    const len = (href.match(regexp) || []).length;
    _.each(_.range(1, len+1), index => {
      ret = ret.replace(regexp, `:param${index}`);
    });
    return ret;
  }

  /**
   * JSON Hyper Schemaからエンドポイントを設定します。
   *
   * @param schema
   * @private
   */
  _generateEndPoints(schema: Object) {
    Object.keys(schema.properties).sort().forEach(property => {
      const {
        $schema, // eslint-disable-line no-unused-vars
        links,
        ...resourceSchema
      } = schema.properties[property];

      this.schemata[property] = resourceSchema;
      links && links.forEach(link => {
        const method = link.method.toLowerCase();
        const path = this._getPath(link.href);
        this.app[method](path, (req, res) => {
          let targetSchema = link.targetSchema || resourceSchema;
          // instancesの場合はそれ自身のresource
          if (link.rel === 'instances') {
            targetSchema = {};
            targetSchema.type = ['array'];
            targetSchema.items = resourceSchema;
          }
          this.jsf.resolve(targetSchema).then(fake => {
            let sample = _.cloneDeep(fake);
            // リソース上書き
            sample = this._extendResource(property, sample);
            // レスポンス上書き
            sample = this._extendResponse(path, sample, req);
            const valid = this._validate(targetSchema, sample);
            this.log(chalk.yellow(`${property} sample validation:`), valid);
            if (valid) {
              res.status(STATUS_SUCCESS).json(sample);
            } else {
              this.log(chalk.red('Invalid sample: '), sample);
              this.fail(res, STATUS_ERROR, this._ajv.errors);
            }
          });
        });
      });
    });
  }

  /**
   * バリデーションを行います。
   *
   * #setErrorSchemata()で設定したJSONSchemaとunionでバリデーションします。
   *
   * @param schema - JSON Schema
   * @param sample - fakeデータ
   * @private
   */
  _validate(schema: Object, sample: Object) {
    return _.some([schema, ...this.globalValidResponseSchemata], schema => {
      return this._ajv.validate(schema, sample);
    });
  }

  /**
   * レスポンスを上書きします。
   *
   * @param path
   * @param sample
   * @param req
   * @returns {Object|Array}
   * @private
   */
  _extendResponse(path: string, sample: Sample, req: any) {
    const mock = this._routing[path];
    if (mock) {
      if (_.isFunction(mock.response)) {
        sample = mock.response(req, sample);
      } else {
        if (mock.override) {
          sample = mock.response;
        }
        else {
          sample = _.merge(sample, mock.response);
        }
      }
    }
    return sample;
  }

  /**
   * リソースを上書きします。
   *
   * @param property
   * @param sample
   * @returns {Object|Array}
   * @private
   */
  _extendResource(property: string, sample: Sample) {
    if (_.isArray(sample)) {
      sample = sample.map(s => {
        return this._extendResource(property, s);
      });
    }
    const mock = this._resources[property];
    if (mock) {
      if (mock.override) {
        sample = _.isArray(sample) ? [mock.response] : mock.response;
      } else {
        sample = _.merge(sample, mock.response);
      }
    }
    return sample;
  }

  /**
   * サーバー設定を行います。
   *
   * @private
   */
  async _configureApp() {
    await this._readSchema();
    this._instance = this.app.listen(this._params.port, () => {
      this.log(`Endpoint:`, chalk.yellow(`http://localhost:${this._params.port}`));
      this._callback && this._callback();
    });
  }

  /**
   * コンソールログを表示します。
   */
  log(...args: any[]) {
    console.log(...args);// eslint-disable-line no-console
  }

  /**
   * エラーレスポンスを返します。
   */
  fail(res: Object, status: number, message: string) {
    res.statusCode = status;
    res.json({error: message});
  }

  /**
   * レスポンスを任意のデータをマージします。
   *
   * @param href
   * @param mock
   * @param override
   */
  extend(href: string, mock: Object, override: boolean = false) {
    this._routing[href] = {
      response: mock,
      override: override,
    };
  }

  /**
   * レスポンスを任意のデータで上書きします。
   *
   * @param href
   * @param mock
   */
  override(href: string, mock: Object) {
    this.extend(href, mock, true);
  }

  /**
   * スキーマリソースをマージします。
   *
   * @param name
   * @param mock
   * @param override
   */
  extendResource(name: string, mock: Object, override: boolean = false) {
    this._resources[name] = {
      response: mock,
      override: override,
    };
  }

  /**
   * スキーマリソースを上書きします。
   *
   * @param name
   * @param mock
   */
  overrideResource(name: string, mock: Object) {
    this.extendResource(name, mock, true);
  }

  /**
   * サーバーを起動します。
   *
   * @param params - Params
   * @param callback - callback
   */
  start(params: Params, callback: () => void) {
    this._params = params;
    this._callback = callback;
    this._configureApp();
  }

  /**
   * サーバーを閉じます。
   *
   * @param callback
   */
  close(callback: () => void) {
    if (this._instance) {
      this.log(chalk.yellow('Closing server'));
      this._instance.close();
      callback && callback();
    }
  }

}
