import test from 'ava';
import R from 'ramda';
import expect, {createSpy} from 'expect';
import retrieveBaseBundleSizes from '../retrieve-base-bundle-sizes';
import {FakeFetch} from '../../test/helpers';
import {PrResource, BuildResource, ArtifactResource} from '../../test/factories';
import {
  GetBaseBranchHandler,
  GetRecentBuildsHandler,
  GetArtifactsHandler,
  GetArtifactHandler
} from '../../test/requests';

const optsFac = (opts = {}) => ({
  pullRequestId: '45',
  bundleSizesFilepath: 'dist/vendor.js',
  ...opts
});

export const createResponseSequence = (opts = {}) => {
  const {
    getBaseBranchResponse,
    getRecentBuildsResponse,
    getArtifactsResponse,
    getArtifactResponse,
    ref,
    buildNum,
    buildStatus,
    artifactPath,
    artifactUrl,
    artifactBody
  } = opts;

  return [
    GetBaseBranchHandler(getBaseBranchResponse || PrResource({ref})),
    GetRecentBuildsHandler(getRecentBuildsResponse || [
      BuildResource({buildNum, status: buildStatus})
    ]),
    GetArtifactsHandler(getArtifactsResponse || [
      ArtifactResource({path: artifactPath, url: artifactUrl})
    ]),
    GetArtifactHandler(getArtifactResponse || {
      response: artifactBody,
      matcher: new RegExp(artifactUrl)
    })
  ];
};

// Factory which makes this easy to test.
const subject = ({responseData, repoOwner, repoName, ...opts} = {}) => {
  const fakeFetch = R.pipe(createResponseSequence, FakeFetch)({
    artifactPath: 'blah8372blah/dist/app.js',
    ...responseData
  });

  return R.pipe(optsFac, retrieveBaseBundleSizes)({
    bundleSizesFilepath: 'dist/app.js',
    ...opts
  }).run({
    request: fakeFetch,
    repoOwner,
    repoName
  });
};

test('happy path (returns artifact body)', async () => {
  const artifact = await subject({
    responseData: {
      artifactBody: 'artifact text'
    }
  });

  expect(artifact).toBe('artifact text');
});

test('uses most recent successful build if latest was unsuccessful', async () => {
  const getArtifactsSpy = createSpy().andReturn([
    ArtifactResource({
      path: '8932hfdlsajlf/thing/dist/my-file.js',
      url: 'http://circle-artifacts/my-url/fj3298hf.json'
    })
  ]);

  await subject({
    bundleSizesFilepath: 'dist/my-file.js',
    responseData: {
      getRecentBuildsResponse: [
        BuildResource({
          buildNum: '935',
          status: 'failure',
          previousSuccessfulBuild: BuildResource({buildNum: '452'})
        }),
        BuildResource({
          buildNum: '452',
          status: 'success'
        })
      ],
      getArtifactsResponse: getArtifactsSpy
    }
  });

  expect(getArtifactsSpy.calls[0].arguments[0]).toMatch(/.*\/452\/artifacts/);
});

test('returns error when there are no recent builds for the base branch', () =>
  subject({
    responseData: {
      ref: 'fjd0823rf2',
      getRecentBuildsResponse: []
    }
  }).catch(error => {
    expect(error).toBeA(Error);
    expect(error.message)
      .toBe('No recent builds found for the base branch: fjd0823rf2!');
  })
);

test('returns error when there are no bundle size artifacts found for latest build of base branch', () =>
  subject({
    responseData: {
      ref: 'lq3i7t42ug',
      buildNum: '6390',
      getArtifactsResponse: []
    }
  }).catch(error => {
    expect(error).toBeA(Error);
    expect(error.message)
      .toBe('No bundle size artifact found for latest build of: lq3i7t42ug. Build number: 6390');
  })
);