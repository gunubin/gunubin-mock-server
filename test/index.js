/* @flow */
import GunubinMockServer from '../src';
import path from 'path';

const dirname = path.resolve();

const mockServer = new GunubinMockServer();

// mockServer.extend('/cards', {
//   id: 2
// });

// mockServer.extendResource('card', {
//   id: 1
// });
mockServer.overrideResource('card', {
  id: 1,
  content: 'foo',
  createdAt: '1988-11-13T19:46:25.430Z',
  title: 'hoge'
});

mockServer.start({
  directory: path.join(dirname, 'test', 'fixtures'),
  port: 3000
}, (err) => {
  if (err) {
    const exit = process.exit;
    exit(1);
  }
});

