import R from 'ramda';
import Ajv from 'ajv';
import fs from 'fs';
import FlatFileDb from 'flat-file-db';
import mkdirp from 'mkdirp';
import {Either} from 'monet';
import {promisify} from 'util';
import {JSON_OUTPUT_SPACING} from './core/constants';

export const compact = list => R.reject(item => !item, list);

export const compactAndJoin = (separator, list) =>
  list |> compact |> R.join(separator);

export const unthrow = fn => (...args) => {
  try {
    return Either.Right(fn(...args));
  } catch(e) {
    return Either.Left(e);
  }
};

export const Database = (...args) => {
  const flatFileDb = FlatFileDb(...args);

  return new Promise(resolve =>
    flatFileDb.on('open', () => resolve(flatFileDb))
  );
};

export const parseJSON = unthrow(JSON.parse);

export const readFile = promisify(fs.readFile);

export const writeFile = promisify(fs.writeFile);

export const getFileStats = promisify(fs.stat);

export const mkdir = promisify(mkdirp);

export const SchemaValidator = () => new Ajv({allErrors: true});

export const truncate = R.curry(({maxSize, contSuffix = '...'}, string) => (
  string.length > maxSize
    ? [string.substring(0, maxSize - contSuffix.length), contSuffix].join('')
    : string
));

export const serializeForFile = val =>
  JSON.stringify(val, null, JSON_OUTPUT_SPACING);
