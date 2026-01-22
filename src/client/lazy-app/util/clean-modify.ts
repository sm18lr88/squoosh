type ArrayOrObject = any[] | object;

function cleanSetOrMerge<A extends ArrayOrObject>(
  source: A,
  keys: string | number | string[],
  toSetOrMerge: ArrayOrObject,
  merge: boolean,
): A {
  const splitKeys = Array.isArray(keys) ? keys : ('' + keys).split('.');

  // Going off road in terms of types, otherwise TypeScript doesn't like the access-by-index.
  // The assumptions in this code break if the object contains things which aren't arrays or
  // plain objects.
  let last = copy(source) as any;
  const newObject = last;

  const lastIndex = splitKeys.length - 1;

  for (const [i, key] of splitKeys.entries()) {
    if (i === lastIndex) {
      // Merge or set.
      last[key] = merge
        ? Object.assign(copy(last[key]), toSetOrMerge)
        : toSetOrMerge;
    } else {
      // Copy everything along the path.
      last = last[key] = copy(last[key]);
    }
  }

  return newObject;
}

function copy<A extends ArrayOrObject>(source: A): A {
  // Some type cheating here, as TypeScript can't infer between generic types.
  if (Array.isArray(source)) return [...source] as any;
  return { ...(source as any) };
}

/**
 * @param source Object to copy from.
 * @param keys Path to modify, eg "foo.bar.baz".
 * @param toMerge A value to merge into the value at the path.
 */
export function cleanMerge<A extends ArrayOrObject>(
  source: A,
  keys: string | number | string[],
  toMerge: ArrayOrObject,
): A {
  return cleanSetOrMerge(source, keys, toMerge, true);
}

/**
 * @param source Object to copy from.
 * @param keys Path to modify, eg "foo.bar.baz".
 * @param newValue A value to set at the path.
 */
export function cleanSet<A extends ArrayOrObject>(
  source: A,
  keys: string | number | string[],
  newValue: any,
): A {
  return cleanSetOrMerge(source, keys, newValue, false);
}
