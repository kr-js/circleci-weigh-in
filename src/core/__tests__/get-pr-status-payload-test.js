import test from 'ava';
import expect from 'expect';
import getPrStatusPayload from '../get-pr-status-payload';

const subject = (opts = {}) => getPrStatusPayload({
  assetDiffs: {
    'app.js': {
      filename: 'app.js',
      difference: 0,
      current: 3523,
      percentChange: 0
    }
  },
  thresholdFailures: [],
  label: '',
  ...opts
});

test("sets state to 'success' when no failures", () => {
  const {state: actual} = subject({thresholdFailures: []});

  expect(actual).toEqual('success');
});

test("sets state to 'failure' when there are failures", () => {
  const {state: actual} = subject({
    thresholdFailures: [{message: 'file3 is too big'}]
  });

  expect(actual).toEqual('failure');
});

test('sets context to label', () => {
  const {context: actual} = subject({
    label: 'asset sizes'
  });

  expect(actual).toEqual('asset sizes');
});

test('sets targetUrl to targetUrl', () => {
  const {targetUrl: actual} = subject({
    targetUrl: 'http://circleci.com/my-repo/242'
  });

  expect(actual).toEqual('http://circleci.com/my-repo/242');
});

test("defaults targetUrl to ''", () => {
  const {targetUrl: actual} = subject();

  expect(actual).toEqual('');
});

test('sets description to concatenated failure messages when there are failures', () => {
  const {description: actual} = subject({
    thresholdFailures: [
      {message: 'file2.js is too big'},
      {message: 'vendor asset is too big'}
    ]
  });

  expect(actual).toEqual('file2.js is too big \nvendor asset is too big');
});

test('sets description to formatted asset diffs when there are no failures', () => {
  const {description: actual} = subject({
    assetDiffs: {
      'app.js': {
        difference: -734729,
        current: 5364634,
        percentChange: -12.046
      },
      'vendor.js': {
        difference: 839,
        current: 4336,
        percentChange: 24
      }
    }
  });

  expect(actual).toEqual('app.js: 5.12MB (-717KB, -12.05%) \nvendor.js: 4.23KB (+839B, +24.00%)');
});

test('truncates description to 140 characters (using ellipsis)', () => {
  const message = "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book.";
  const {description: actual} = subject({
    thresholdFailures: [{message}]
  });

  // Sanity check
  expect(message.length).toBeGreaterThan(140);
  expect(actual).toBe("Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever s...");
});
