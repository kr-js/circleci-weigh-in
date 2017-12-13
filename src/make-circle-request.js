import {camelizeKeys} from 'humps';
import R from 'ramda';
import ReaderPromise from './core/reader-promise';
import {CircleCiFetchErr, CircleCiInvalidResponseErr} from './core/errors';

const circleDeserializer = payload => camelizeKeys(payload);

const API_ROOT = 'https://circleci.com/api/v1.1';

export default ({path, url, fetchOpts = {}, raw = false}) =>
  ReaderPromise.fromReaderFn(({request, circleApiToken}) => {
    const finalUrl = `${url || [API_ROOT, path].join('/')}`
      + `?circle-token=${circleApiToken}`;

    return request(finalUrl, {
      headers: {Accept: 'application/json', ...fetchOpts.headers},
      ...R.omit('headers', fetchOpts)
    })
      .catch(response =>
        CircleCiFetchErr(finalUrl, response) |> a => Promise.reject(a)
      )
      .then(response => {
        if(response.ok) return response.json();

        return CircleCiInvalidResponseErr(finalUrl, response.statusText)
          |> a => Promise.reject(a);
      })
      .then(raw ? a => a : circleDeserializer);
  });
