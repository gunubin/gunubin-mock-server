# gunubin-mock-server

[![Build Status](https://travis-ci.org/gunubin/gunubin-mock-server.svg?branch=master)](https://travis-ci.org/gunubin/gunubin-mock-server)
[![codecov](https://codecov.io/gh/gunubin/gunubin-mock-server/branch/master/graph/badge.svg)](https://codecov.io/gh/gunubin/gunubin-mock-server)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://codecov.io/gh/gunubin/gunubin-mock-server)

## Installation
```
npm install --save-dev gunubin-mock-server
```

## Usage

```javascript
import GunubinMockServer from 'gunubin-mock-server';

const mockServer = new GunubinMockServer();
mockServer.start({
  directory: 'pathto/jsonschema/directory',
  port: 3000
});

mockServer.extend('/todo', {
  foo: 'bar' 
});

mockServer.extendResource('todo', {
  foo: 'bar' 
});

```
