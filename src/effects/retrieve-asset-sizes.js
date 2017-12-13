import R from 'ramda';
import {Either} from 'monet';
import makeGitHubRequest from '../make-github-request';
import makeCircleRequest from '../make-circle-request';
import ReaderPromise from '../core/reader-promise';
import {CircleCiBuildStatuses} from '../core/constants';
import {NoRecentBuildsFoundErr, NoAssetStatsArtifactFoundErr}
  from '../core/errors';

export default ({pullRequestId, assetSizesFilepath}) =>
  ReaderPromise.fromReaderFn(config => {
    const repoProjectPath = [config.repoOwner, config.repoName].join('/');

    const getBaseBranch = makeGitHubRequest({
      path: `repos/${repoProjectPath}/pulls/${pullRequestId}`
    });

    const getRecentBuilds = baseBranch =>
      makeCircleRequest({
        path: `project/github/${repoProjectPath}/tree/${baseBranch}`
      });

    const getBuildArtifacts = buildNumber =>
      makeCircleRequest({
        path: `project/github/${repoProjectPath}/${buildNumber}/artifacts`
      });

    const getAssetSizeArtifact = assetSizeArtifactUrl =>
      makeCircleRequest({url: assetSizeArtifactUrl, raw: true});

    return getBaseBranch.chain(prData => {
      const baseBranch = prData.base.ref;

      return getRecentBuilds(baseBranch).chain(recentBuilds => {
        if(recentBuilds.length === 0) {
          return baseBranch
            |> NoRecentBuildsFoundErr
            |> Either.Left
            |> ReaderPromise.of;
        }

        const [firstItem] = recentBuilds;
        const buildNumber = firstItem.status === CircleCiBuildStatuses.SUCCESS
          ? firstItem.buildNum
          : firstItem.previousSuccessfulBuild.buildNum;

        return getBuildArtifacts(buildNumber).chain(buildArtifacts => {
          const artifactPathRegExp = new RegExp(`${assetSizesFilepath}$`);
          const assetSizeArtifact = buildArtifacts
            .find(artifact => artifact.path.match(artifactPathRegExp));
          if(!assetSizeArtifact) {
            return NoAssetStatsArtifactFoundErr(baseBranch, buildNumber)
              |> Either.Left
              |> ReaderPromise.of;
          }

          return getAssetSizeArtifact(assetSizeArtifact.url).map(Either.Right);
        });
      });
    }).run(config);
  });
