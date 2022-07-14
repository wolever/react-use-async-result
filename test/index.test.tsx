import React from 'react'
import { cleanup, render, renderHook } from '@testing-library/react'
import { act as _act } from "react-dom/test-utils"
import { expectTypeOf } from 'expect-type'

import { AsyncResult, AsyncResultDone, AsyncResultEmpty, AsyncResultError, AsyncResultNotDone, AsyncResultPending, useAsyncResult, UseAsyncResult } from '../src'

describe('AsyncResult', () => {
  describe('states', () => {
    [
      ['empty', AsyncResult.empty(), { isEmpty: true }],
      ['pending', AsyncResult.pending(), { isPending: true }],
      ['error', AsyncResult.error('uhoh'), { isError: true, error: 'uhoh' }],
      ['done', AsyncResult.done('yay'), { isDone: true, result: 'yay' }],
    ].forEach(tc => {
      const [state, input, expected] = tc as any
      it(state, () => {
        expect(input).toMatchObject({
          state,
          isEmpty: false,
          isPending: false,
          isError: false,
          isDone: false,
          ...expected,
        })
      })
    })
  })

  describe('isAsyncResult', () => {
    [
      ['Promise', new Promise(() => {}), false],
      ['null', new Promise(() => {}), false],
      ['AsyncResult', AsyncResult.empty(), true],
    ].forEach(tc => {
      const [name, input, expected] = tc as any
      it(`${name} (${expected})`, () => {
        expect(AsyncResult.isAsyncResult(input)).toEqual(expected)
      })
    })
  })
})

describe('useAsyncResult', () => {
  let bodyText: string

  const act = async (cb: () => Promise<void>) => {
    await _act(cb)
    bodyText = window.document.body.textContent || ""
  }
  const asyncRender = async (c: React.ReactElement) => {
    await act(async () => {
      render(c)
    })
  }

  const setupTest = async (initialState: any) => {
    let setState: any
    let asyncResult: any

    const UseAsyncResultTest = () => {
      const [state, _setState] = React.useState({
        promise: Promise.resolve("setup"),
        trigger: "1",
        ...initialState,
      })
      setState = (newState: any) => {
        _setState({
          ...state,
          ...newState,
        })
      }
      asyncResult = useAsyncResult(() => state.promise, [state.trigger])
      return <div>{JSON.stringify(asyncResult)} / useEffectTrigger:{state.trigger}</div>
    }

    await asyncRender(<UseAsyncResultTest />)
    return {
      setState: async (state: { promise?: Promise<any>, trigger?: string }) => {
        await act(async () => setState(state))
      },
      asyncResult: asyncResult as UseAsyncResult<any>,
    }
  }


  it("works", async () => {
    await setupTest({
      promise: Promise.resolve("hello, world!")
    })
    expect(bodyText).toContain("hello, world!")
  })

  const makeTestPromise = () => {
    const res = {} as any
    res.promise = new Promise((resolve, reject) => {
      res.resolve = (val: any) => act(async () => resolve(val)),
      res.reject = (val: any) => act(async () => reject(val))
    })
    return res as {
      promise: Promise<any>,
      resolve: (val: any) => Promise<void>,
      reject: (err: any) => Promise<void>,
    }
  }

  it("handles ordering correctly", async () => {
    const p1 = makeTestPromise()
    const p2 = makeTestPromise()

    const test = await setupTest({ promise: p1.promise })
    expect(bodyText).toContain("pending")
    expect(bodyText).toContain("useEffectTrigger:1")

    await test.setState({
      promise: p2.promise,
      trigger: "2",
    })
    await p1.resolve("p1 resolved")
    expect(bodyText).toContain("pending")
    expect(bodyText).toContain("useEffectTrigger:2")

    await p2.resolve("p2 resolved")
    expect(bodyText).toContain("p2 resolved")
    expect(bodyText).toContain("useEffectTrigger:2")
  })

  it("clears correctly", async () => {
    const test = await setupTest({ promise: Promise.resolve("hello, world") })
    expect(bodyText).toContain("hello, world")

    await act(async () => {
      test.asyncResult.clear()
    })
    expect(bodyText).toContain("empty")
  })

  it("re-binds correctly", async () => {
    const test = await setupTest({ promise: Promise.resolve("hello, world") })
    expect(bodyText).toContain("hello, world")

    await act(async () => {
      test.asyncResult.bind(Promise.reject("uh oh"))
    })
    expect(bodyText).toContain("uh oh")
    expect(bodyText).toContain('"isError":true')
  })

  it("chains", async () => {
    const test = await setupTest({ promise: Promise.resolve("hello, world") })
    expect(bodyText).toContain("hello, world")

    await act(async () => {
      test.asyncResult.bind(Promise.resolve(AsyncResult.empty()))
    })
    expect(bodyText).toContain("empty")
    expect(bodyText).toContain('"isEmpty":true')
  })

  describe('typing', () => {
    it('simple checks', async () => {
      expectTypeOf(AsyncResult.done("foo")).toMatchTypeOf<AsyncResult<string>>()
      expectTypeOf(AsyncResult.done("foo")).toMatchTypeOf<AsyncResultDone<string>>()
      expectTypeOf(AsyncResult.pending()).toMatchTypeOf<AsyncResult<string>>()
      expectTypeOf(AsyncResult.pending()).not.toMatchTypeOf<AsyncResultDone<string>>()
      expectTypeOf(AsyncResult.empty()).toMatchTypeOf<AsyncResult<string>>()
      expectTypeOf(AsyncResult.error(42)).toMatchTypeOf<AsyncResult<string>>()
    })

    it('AsyncResultNotDone', async () => {
      expectTypeOf<AsyncResultEmpty>().toMatchTypeOf<AsyncResultNotDone>()
      expectTypeOf<AsyncResultPending>().toMatchTypeOf<AsyncResultNotDone>()
      expectTypeOf<AsyncResultError>().toMatchTypeOf<AsyncResultNotDone>()
      expectTypeOf<AsyncResultDone>().not.toMatchTypeOf<AsyncResultNotDone>()
    })

    it('expected type errors', async () => {
      const x = renderHook(() => useAsyncResult(() => Promise.resolve(42)))
      cleanup()

      const result = x.result.current

      expectTypeOf(result).toMatchTypeOf<AsyncResult<number>>()

      // @ts-expect-error
      result.result

      // @ts-expect-error
      result.error

      // Conditional guards should allow type specificity
      if (result.isError) result.error
      if (result.isDone) result.result
      // @ts-expect-error
      if (result.isError) result.result
      // @ts-expect-error
      if (result.isDone) result.error

      // Should not be able to bind to a promise of a different type
      // @ts-expect-error
      result.bind(Promise.resolve("foo"))
    })

    it('chains', async () => {
      renderHook(() => useAsyncResult<string>(async () => {
        if (false as any)
          return AsyncResult.pending()
        return "foo"
      }))
      cleanup()
    })

    it('isAsyncResult asserts type', async () => {
      const t: any = null
      if (AsyncResult.isAsyncResult(t)) {
        expectTypeOf(t).toMatchTypeOf<AsyncResult<any>>()
        expectTypeOf(t.state).toMatchTypeOf<string>()
      }
    })

    describe('wrap returns correct type', () => {
      it('on resolve', async () => {
        const res = AsyncResult.wrap(Promise.resolve(42))
        expectTypeOf(res).toMatchTypeOf<Promise<AsyncResult<number>>>()
        const val = await res
        expect(val).toEqual(AsyncResult.done(42))
      })

      it('on reject', async () => {
        const p = Promise.reject(42)
        const res = AsyncResult.wrap(p)
        expectTypeOf(res).toMatchTypeOf<Promise<AsyncResult<never>>>()
        const val = await res
        expect(val).toEqual(AsyncResult.error(42))
      })
    })
  })
})