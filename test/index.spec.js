/* @flow */
import test from 'ava';
import request from 'supertest';
import GunubinMockServer from '../src';
import path from 'path';

const dirname = path.resolve();
let port = 3010;

test.cb.beforeEach(t => {
  const mockServer = new GunubinMockServer();
  mockServer.start({
    glob: path.join(dirname, 'test', 'fixtures', 'schema.json'),
    port: port++
  }, (err) => {
    t.end();
    if (err) {
      const exit = process.exit;
      exit(1);
    }
  });
  t.context.server = mockServer;
});

test.cb.afterEach(t => {
  t.context.server.close(() => t.end());
});

test('status 200', async t => {
  const res = await request(t.context.server.app).get('/todo');
  t.is(res.status, 200);
});

test('#extend()', async t => {
  t.context.server.extend('/todo', [{
    id: 10
  }]);
  const res = await request(t.context.server.app).get('/todo');
  t.is(res.body[0].id, 10);
});

test('#extendResource()', async t => {
  t.context.server.extendResource('todo', {
    id: 2
  });
  const res = await request(t.context.server.app).get('/todo');
  t.is(res.body[0].id, 2);
});

test('#override()', async t => {
  t.context.server.override('/todo', [{
    id: 1,
    content: 'foo',
    createdAt: '1988-11-13T19:46:25.430Z',
    title: 'hoge'
  }]);
  const res = await request(t.context.server.app).get('/todo');
  t.is(res.body[0].id, 1);
});

test('#overrideResource()', async t => {
  t.context.server.overrideResource('todo', {
    id: 10,
    content: 'foo',
    createdAt: '1988-11-13T19:46:25.430Z',
    title: 'hoge'
  });
  const res = await request(t.context.server.app).get('/todo');
  t.is(res.body[0].id, 10);
});

test('JSON Schema Validation Error', async t => {
  t.context.server.extend('/task', {
    content: 1,
  });
  const res = await request(t.context.server.app).get('/task');
  t.is(res.body.error[0].dataPath, '.content');
});

test('targetSchema', async t => {
  const res = await request(t.context.server.app).get('/task');
  t.true(!!res.body.content);
});

test('Custom Error response', async t => {
  t.context.server.errorSchemata = [{
      'title': 'エラー',
      'description': 'エラーレスポンスを表します。',
      'stability': 'prototype',
      'strictProperties': true,
      'type': [
        'object'
      ],
      'properties': {
        'type': {
          'description': 'エラーの種別',
          'enum': [
            'foo_error',
            'bar_error',
          ]
        },
        'status': {
          'status': {
            'description': 'ステータスコード',
            'example': 400,
            'readOnly': true,
            'type': [
              'integer'
            ]
          }
        }
      },
      'required': [
        'type',
        'status'
      ]
  }];
  t.context.server.override('/task', {
    type: 'foo_error',
    status: 400,
  });
  const res = await request(t.context.server.app).get('/task');
  t.is(res.body.status, 400);
});

