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

type Mock = {
  override: boolean,
  resource: Object,
}

type Sample = any


const STATUS_SUCCESS = 200;
const STATUS_ERROR = 400;

/**
 * GunubinMockServer
 */
export default class GunubinMockServer {
  ajv: Ajv;
  app: any;
  callback: () => void;
  instance: any;
  jsf: jsf;
  resources: {[key: string]: Mock} = {};
  routing: {[key: string]: Mock} = {};
  params: Params;
  parser: $RefParser;

  /**
   * constructor
   *
   * @param jsf - json-schema-faker
   */
  constructor() {
    this.jsf = jsf;
    this.app = express();
    this.parser = new $RefParser();
    this.ajv = new Ajv();
  }

  /**
   * JSON Schemaファイルを読み込みます。
   *
   * @private
   */
  async _readSchema() {
    return new Promise((resolve) => {
      glob(path.join(this.params.glob), {nonull: true}, (err, files) => {
        const promises = [];
        files.map(file => {
          const promise = new Promise(resolve => {
            $RefParser.dereference(file, (err, schema) => {
              this.log('find schema file:', chalk.green(file));
              if (err) {
                this.log(err);
              }
              this._generateEndPoint(schema);
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
   * JSON Hyper Schemaからエンドポイントを設定します。
   *
   * @param schema
   * @private
   */
  _generateEndPoint(schema: Object) {
    Object.keys(schema.properties).sort().forEach(property => {
      const {
        $schema, // eslint-disable-line no-unused-vars
        links,
        ...resourceSchema
      } = schema.properties[property];

      links && links.forEach(link => {
        const method = link.method.toLowerCase();
        const href = link.href.replace(/\{\(.*\)\}/g, ':id');
        this.app[method](href, (req, res) => {
          let targetSchema = link.targetSchema || resourceSchema;
          // instancesの場合はそれ自身のresource
          if (link.rel === 'instances') {
            targetSchema = {};
            targetSchema.type = ['array'];
            targetSchema.items = resourceSchema;
          }
          this.jsf.resolve(targetSchema).then((sample) => {
            sample = this._doExtend(property, link.href, sample);
            const valid = this.ajv.validate(targetSchema, sample);
            this.log(chalk.yellow(`${property} sample validation:`), valid);
            if (valid) {
              res.status(STATUS_SUCCESS).json(sample);
            } else {
              this.log('sample: ', sample);
              this.fail(res, STATUS_ERROR, this.ajv.errors);
            }
          });
        });
      });
    });
  }

  /**
   * レスポンスを上書きします。
   *
   * @param property - Schemaのproperty
   * @param href - Schemaのhref
   * @param sample - fakerで生成したObject
   * @private
   */
  _doExtend(property: string, href: string, sample: Sample): Sample {
    // リソース上書き
    sample = this._doExtendResource(property, sample);
    // レスポンス上書き
    sample = this._doExtendResponse(href, sample);
    return sample;
  }

  /**
   * レスポンスを上書きします。
   *
   * @param href
   * @param sample
   * @returns {Object|Array}
   * @private
   */
  _doExtendResponse(href: string, sample: Sample) {
    const mock = this.routing[href];
    if (mock) {
      if (mock.override) {
        sample = mock.resource;
      }
      else {
        sample = _.merge(sample, mock.resource);
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
  _doExtendResource(property: string, sample: Sample) {
    if (_.isArray(sample)) {
      sample = sample.map(s => {
        return this._doExtendResource(property, s);
      });
    }
    const mock = this.resources[property];
    if (mock) {
      if (mock.override) {
        sample = _.isArray(sample) ? [mock.resource] : mock.resource;
      } else {
        sample = _.merge(sample, mock.resource);
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
    this.instance = this.app.listen(this.params.port, () => {
      this.log(`Endpoint:`, chalk.yellow(`http://localhost:${this.params.port}`));
      this.callback && this.callback();
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
    this.routing[href] = {
      resource: mock,
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
    this.resources[name] = {
      resource: mock,
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
    this.params = params;
    this.callback = callback;
    this._configureApp();
  }

  /**
   * サーバーを閉じます。
   *
   * @param callback
   */
  close(callback: () => void) {
    if (this.instance) {
      this.log(chalk.yellow('Closing server'));
      this.instance.close();
      callback && callback();
    }
  }

}
