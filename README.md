# gunubin-mock-server

[![Build Status](https://travis-ci.org/gunubin/gunubin-mock-server.svg?branch=master)](https://travis-ci.org/gunubin/gunubin-mock-server)
[![codecov](https://codecov.io/gh/gunubin/gunubin-mock-server/branch/master/graph/badge.svg)](https://codecov.io/gh/gunubin/gunubin-mock-server)

## Installation
```
npm install --save gunubin-mock-server
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
