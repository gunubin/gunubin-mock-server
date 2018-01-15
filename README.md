# gunubin-mock-server

[![Build Status](https://travis-ci.org/gunubin/gunubin-mock-server.svg?branch=master)](https://travis-ci.org/gunubin/gunubin-mock-server)
[![codecov](https://codecov.io/gh/gunubin/gunubin-mock-server/branch/master/graph/badge.svg)](https://codecov.io/gh/gunubin/gunubin-mock-server)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://www.npmjs.com/package/gunubin-mock-server)

## Installation
```
npm install --save-dev gunubin-mock-server
```

## Usage

```javascript
import GunubinMockServer from 'gunubin-mock-server';

const mockServer = new GunubinMockServer();
mockServer.start({
  glob: 'pathto/schema.json',
  port: 3000
});

mockServer.extend('/todo', {
  foo: 'bar' 
});

mockServer.extend('/todo', req => {
  return {
    foo: req.params.param1
  }
});

mockServer.extendResource('todo', {
  foo: 'bar' 
});

mockServer.override('/todo', {
  foo: 'foo',
  bar: 'bar'
});

mockServer.overrideResource('todo', {
  foo: 'foo',
  bar: 'bar'
});

mockServer.globalValidResponseSchemata = [{
  'title': 'ラー',
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

mockServer.override('/task', {
  type: 'hoge_error',
  status: 400
});

```
