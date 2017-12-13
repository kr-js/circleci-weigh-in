import R from 'ramda';
import test from 'ava';
import expect, {createSpy} from 'expect';
import {Maybe, Either} from 'monet';
import {
  NoOpenPullRequestFoundErr,
  InvalidFailureThresholdErr,
  InvalidFailureThresholdOptionErr
} from '../core/errors';
import circleciWeighIn from '../circleci-weigh-in';
import ReaderPromise from '../core/reader-promise';

const RightReaderPromise = R.pipe(Either.Right, ReaderPromise.of);

const subject = (opts = {}) => {
  const {
    logError = console.error,
    logMessage = console.log,
    getFileStats = Promise.resolve({size: 452}) |> R.always,
    ...rest
  } = opts;

  return circleciWeighIn({
    statsFilepath: 'dist/stats.js',
    projectName: Maybe.None(),
    outputDirectory: '',
    failureThresholds: [],
    buildSha: '8fdhihfj',
    buildUrl: 'http://circle.com/my-build',
    pullRequestId: Maybe.of('f820yf3h'),
    artifactsDirectory: 'lfjk3208hohefi4/artifacts',
    effects: {
      getAssetFileStats: () => ReaderPromise.of([{
        size: 242,
        filename: 'app.js',
        path: 'dist/app.js'
      }]),
      retrieveAssetSizes: () => RightReaderPromise({
        'app.js': {
          size: 300,
          path: 'dist/app.js'
        }
      }),
      postFinalPrStatus: () => ReaderPromise.of(),
      postPendingPrStatus: () => ReaderPromise.of(),
      postErrorPrStatus: () => ReaderPromise.of(),
      readManifest: () => ReaderPromise.of({'app.js': 'app.js'}),
      resolve: (...args) => ReaderPromise.of(['/root/builds', args.join('/')].join('/')),
      makeArtifactDirectory: () => ReaderPromise.of(),
      writeAssetStats: () => ReaderPromise.of(),
      writeAssetDiffs: () => ReaderPromise.of(),
      saveStats: ReaderPromise.of,
      ...(opts.effects ? opts.effects : {})
    },
    ...R.omit(['effects'], rest)
  }).run({logMessage, logError, getFileStats});
};

const firstCallFirstArgument = R.path(['calls', 0, 'arguments', 0]);

test('happy path (makes artifact directory, writes asset stats to file, and writes asset diffs to file)', () => {
  const writeAssetDiffsSpy = createSpy().andReturn(ReaderPromise.of());
  const writeAssetStatsSpy = createSpy().andReturn(ReaderPromise.of());
  const makeArtifactDirectorySpy = createSpy().andReturn(ReaderPromise.of());

  return subject({
    failureThresholds: [{targets: 'app.js', maxSize: 50}],
    outputDirectory: 'dist',
    effects: {
      getAssetFileStats: () => ReaderPromise.of([{
        size: 200,
        filename: 'app.js',
        path: 'dist/app.js'
      }]),
      writeAssetDiffs: writeAssetDiffsSpy,
      writeAssetStats: writeAssetStatsSpy,
      makeArtifactDirectory: makeArtifactDirectorySpy,
      readManifest: () => ReaderPromise.of({'app.js': 'app.js'}),
      retrieveAssetSizes: () => RightReaderPromise({
        'app.js': {
          size: 20,
          path: 'dist/app.js'
        }
      })
    }
  }).then(() => {
    const {
      rootPath: assetStatsRootPath,
      assetStats: assetStatsContents
    } = firstCallFirstArgument(writeAssetStatsSpy);

    const {
      rootPath: assetDiffsRootPath,
      assetDiffs: assetDiffsContents,
      thresholdFailures
    } = firstCallFirstArgument(writeAssetDiffsSpy);

    expect(makeArtifactDirectorySpy).toHaveBeenCalledWith({
      rootPath: 'lfjk3208hohefi4/artifacts'
    });

    expect(assetStatsRootPath).toEqual('lfjk3208hohefi4/artifacts');
    expect(assetStatsContents).toEqual({
      'app.js': {
        path: 'dist/app.js',
        size: 200
      }
    });

    expect(assetDiffsRootPath).toEqual('lfjk3208hohefi4/artifacts');
    expect(assetDiffsContents).toEqual({
      'app.js': {
        current: 200,
        difference: 180,
        original: 20,
        percentChange: 900
      }
    });

    expect(thresholdFailures).toEqual([{
      message: '"app.js" (200B) must be less than or equal to 50B!',
      threshold: {strategy: 'any', targets: 'app.js', maxSize: 50},
      offendingAssets: ['app.js']
    }]);
  });
});

test('returns error when non-schema-matching failure threshold is provided', () => {
  const logErrorSpy = createSpy();

  return subject({
    failureThresholds: [{targets: '.js'}],
    logError: logErrorSpy
  }).catch(() => {
    expect(logErrorSpy).toHaveBeenCalledWith(
      InvalidFailureThresholdOptionErr(
        "data[0] should have required property 'maxSize'"
      ).message
    );
  });
});

test('handles case where no open pull request is found', () => {
  const logMessageSpy = createSpy();

  return subject({pullRequestId: Maybe.None(), logMessage: logMessageSpy})
    .then(() => {
      expect(logMessageSpy)
        .toHaveBeenCalledWith(NoOpenPullRequestFoundErr().message);
    });
});

test('handles invalid failure threshold case', () => {
  const logErrorSpy = createSpy();

  return subject({
    getFileStats: Promise.resolve({size: 32432}) |> R.always,
    logError: logErrorSpy,
    readManifest: () => ReaderPromise.of({'app.js': 'app.js'}),
    failureThresholds: [{targets: '.css', maxSize: 45}]
  }).catch(() => {
    expect(logErrorSpy)
      .toHaveBeenCalledWith(InvalidFailureThresholdErr('.css').message);
  });
});

test('surfaces errors reading stats file', () => {
  const logErrorSpy = createSpy();

  return subject({
    effects: {
      readManifest: () => ReaderPromise.fromError({message: 'oh noes'})
    },
    logError: logErrorSpy
  }).catch(() => {
    expect(logErrorSpy).toHaveBeenCalledWith('oh noes');
  });
});

test('surfaces errors making artifact directory', () => {
  const logErrorSpy = createSpy();

  return subject({
    effects: {
      makeArtifactDirectory: () => ReaderPromise.fromError({message: 'oh noes'})
    },
    logError: logErrorSpy
  }).catch(() => {
    expect(logErrorSpy).toHaveBeenCalledWith('oh noes');
  });
});

test('surfaces errors writing asset sizes', () => {
  const logErrorSpy = createSpy();

  return subject({
    effects: {
      writeAssetStats: () => ReaderPromise.fromError({message: 'uh oh'})
    },
    logError: logErrorSpy
  }).catch(() => {
    expect(logErrorSpy).toHaveBeenCalledWith('uh oh');
  });
});

test('surfaces errors writing asset diffs', () => {
  const logErrorSpy = createSpy();

  return subject({
    effects: {
      writeAssetDiffs: () => ReaderPromise.fromError({message: 'uh oh'})
    },
    logError: logErrorSpy
  }).catch(() => {
    expect(logErrorSpy).toHaveBeenCalledWith('uh oh');
  });
});

test('saves stats to local db when project name is given', () => {
  const saveStatsSpy = createSpy().andCall(ReaderPromise.of);

  return subject({
    projectName: Maybe.of('my-proj'),
    effects: {
      saveStats: saveStatsSpy,
      getAssetFileStats: () => ReaderPromise.of([{
        filename: 'app.js',
        size: 983,
        path: 'dist/app.js'
      }]),
      retrieveAssetSizes: () => RightReaderPromise({
        'other-proj': {
          'app.js': {
            size: 300,
            path: 'dist/app.js'
          }
        },
        'my-proj': {
          'app.js': {
            size: 242,
            path: 'dist/app.js'
          }
        }
      })
    }
  }).then(() => {
    expect(saveStatsSpy).toHaveBeenCalledWith({
      'other-proj': {
        'app.js': {
          size: 300,
          path: 'dist/app.js'
        }
      },
      'my-proj': {
        'app.js': {
          size: 983,
          path: 'dist/app.js'
        }
      }
    });
  });
});

test.todo('handles case where previous build has no stats for current project');

test.todo('posts error PR status when error is encountered');
