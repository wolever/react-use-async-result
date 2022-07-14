import { useEffect, useState } from 'react'

type NotEmpty = Exclude<any, null | false | undefined | 0 | ''>

export type AsyncResultPending = {
  state: 'pending',
  isEmpty: false,
  isPending: true,
  isError: false,
  isDone: false,
  [Symbol.toStringTag]: 'AsyncResultPending',
}

export type AsyncResultError = {
  state: 'error',
  isEmpty: false,
  isPending: false,
  isError: true,
  isDone: false,
  error: NotEmpty,
  [Symbol.toStringTag]: 'AsyncResultError',
}

export type AsyncResultDone<R=unknown> = {
  state: 'done',
  isEmpty: false,
  isPending: false,
  isError: false,
  isDone: true,
  result: R,
  [Symbol.toStringTag]: 'AsyncResultDone',
}

export type AsyncResultEmpty = {
  state: 'empty',
  isEmpty: true,
  isPending: false,
  isError: false,
  isDone: false,
  [Symbol.toStringTag]: 'AsyncResultEmpty',
}

export type AsyncResult<R> = (
  AsyncResultPending |
  AsyncResultError |
  AsyncResultDone<R> |
  AsyncResultEmpty
)

export type AsyncResultNotDone = (
  AsyncResultPending |
  AsyncResultError |
  AsyncResultEmpty
)

export const AsyncResult = {
  /**
   * Returns `true` if `obj` is an AsyncResult, otherwise `false`.
   */
  isAsyncResult<R=unknown>(obj: any): obj is AsyncResult<R> {
    return (
      !!obj &&
      typeof obj.state == 'string' &&
      typeof obj.isEmpty == 'boolean' &&
      typeof obj.isPending == 'boolean' &&
      typeof obj.isError == 'boolean' &&
      typeof obj.isDone == 'boolean'
    )
  },

  /**
   * Wraps a promise, ensuring that - if it completes - the result will be
   * an `AsyncResult`.
   *
   * If it resolves, the result will be an `AsyncResultDone`, if it errors
   * the result will be an `AsyncResultError`, and if it resolves to an
   * `AsyncResult`, the result will be that `AsyncResult`.
   *
   * For example:
   *
   * ``ts
   * > AsyncResult.wrap(new Promise(res => resolve("done!"))).then(console.log)
   * { state: 'done', isDone: true, ..., result: 'done!' }
   * > AsyncResult.wrap(new Promise((_, rej) => rej("error!"))).then(console.log)
   * { state: 'error', isError: true, ..., error: 'error!' }
   * > AsyncResult.wrap(new Promise(res => res(AsyncResult.empty()))).then(console.log)
   * { state: 'empty', isEmpty: true, ... }
   */
  wrap<R>(promise: Promise<R | AsyncResult<R>>): Promise<AsyncResult<R>> {
    return promise.then(
      res => AsyncResult.isAsyncResult<R>(res) ? res : AsyncResult.done(res),
      err => AsyncResult.isAsyncResult<R>(err) ? err : AsyncResult.error(err),
    )
  },

  /**
   * Returns a "pending" AsyncResult.
   */
  pending(): AsyncResultPending {
    return {
      state: 'pending',
      isEmpty: false,
      isPending: true,
      isError: false,
      isDone: false,
      [Symbol.toStringTag]: 'AsyncResultPending',
    }
  },

  /**
   * Returns an "error" AsyncResult.
   */
  error(error: any): AsyncResultError {
    return {
      state: 'error',
      isEmpty: false,
      isPending: false,
      isError: true,
      isDone: false,
      error: error,
      [Symbol.toStringTag]: 'AsyncResultError',
    }
  },

  /**
   * Returns a "done" AsyncResult.
   */
  done<R>(res: R): AsyncResultDone<R> {
    return {
      state: 'done',
      isEmpty: false,
      isPending: false,
      isError: false,
      isDone: true,
      result: res,
      [Symbol.toStringTag]: 'AsyncResultDone',
    }
  },

  /**
   * Returns an "empty" AsyncResult.
   */
  empty(): AsyncResultEmpty {
    return {
      state: 'empty',
      isEmpty: true,
      isPending: false,
      isError: false,
      isDone: false,
      [Symbol.toStringTag]: 'AsyncResultEmpty'
    }
  },
}

type UseAsyncResultBase<R> = {
  /**
   * Clears the active promise, returning the state to `AsyncResultEmpty`.
   */
  clear(): void

  /**
   * Sets or replaces the active promise to `promise`.
   */
  bind(promise: Promise<R>): void
}

export type UseAsyncResultPending<R> = UseAsyncResultBase<R> & AsyncResultPending
export type UseAsyncResultError<R> = UseAsyncResultBase<R> & AsyncResultError
export type UseAsyncResultDone<R> = UseAsyncResultBase<R> & AsyncResultDone<R>
export type UseAsyncResultEmpty<R> = UseAsyncResultBase<R> & AsyncResultEmpty
export type UseAsyncResult<R> = (
  UseAsyncResultPending<R> |
  UseAsyncResultError<R> |
  UseAsyncResultDone<R> |
  UseAsyncResultEmpty<R>
)

/**
 * Expose a Promise's states (loading/error/done/empty) to a React component.
 *
 * For example:
 *
 * ```tsx
 * const userReq = useAsyncResult<User>(async () => {
 *   const resp = fetch(`/users/{userId}`)
 *   return resp.json()
 * }, [userId])
 *
 * if (userReq.isError)
 *   return <div>Error: {userReq.error}</div>
 *
 * if (userReq.isPending)
 *   return <div>Loading...</div>
 *
 * return <div>Username: {userReq.result.username}</div>
 * ```
 *
 * In addition to providing a Promise callback, the `.bind(...)` method can
 * be used to add or replace the active Promise:
 *
 * ```tsx
 * const usrSaveReq = useAsyncResult()
 * const saveUser = (newUser: User) => {
 *   userSaveReq.bind(fetch({
 *     method: 'POST',
 *     url: `/users/{userId}`,
 *     data: newUser,
 *   }))
 * }
 *
 * // ... snip ...
 *
 * return <div>
 *   ...
 *   <button
 *     disabled={saveUserReq.isPending}
 *     onClick={() => saveUser({ ... })}>
 *       Save User
 *   </button>
 *   {userSaveReq.isError && <div>Save error: {'' + userSaveReq.error}</div>}
 * </div>
 * ```
 */
export function useAsyncResult<R=unknown>(
  getPromise?: () => Promise<R> | Promise<AsyncResult<R>> | null,
  useEffectOnChangeList: any[]= [],
): UseAsyncResult<R> {
  const [ promiseCounter ] = useState({
    count: 0,
  })

  function setPromise(promise: Promise<R> | Promise<AsyncResult<R>> | null) {
    const thisCount = promiseCounter.count + 1
    promiseCounter.count = thisCount

    if (!promise) {
      setRes(AsyncResult.empty())
      return
    }

    setRes(AsyncResult.pending())

    AsyncResult.wrap(promise)
      .then(res => {
        if (promiseCounter.count != thisCount)
          return
        setRes(res)
      })
  }

  const _addBind = (p: AsyncResult<R>): UseAsyncResult<R> => {
    return {
      ...p,
      bind: setPromise,
      clear: () => setPromise(null),
    }
  }
  const [res, _setRes] = useState<UseAsyncResult<R>>(_addBind(AsyncResult.empty()))
  const setRes = (p: AsyncResult<R>) => _setRes(_addBind(p))

  useEffect(() => {
    setPromise(getPromise ? getPromise() : null)
  }, useEffectOnChangeList || [])

  return res
}