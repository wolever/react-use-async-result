# `use-async-result`: Simple, Comprehensive, Type-Safe Promises in React Components

`use-async-result` is a simple, comprehensive, and type-safe library for exposing
a Promise's states (loading/error/done/empty) to a React component.

## Installation

Install with `npm`:

```
npm install --save-dev react-use-async-result
```

Or with `yarn`:

```
yarn add react-use-async-result
```

And import with:

```ts
import { useAsyncResult } from 'react-use-async-result'
```

## Simple Example

The following is a simple, naïve, example of `useAsyncResult`; for a more
complete, real-world, example, see [Complete Example](#complete-example), below.

```tsx
import { useAsyncResult } from 'react-use-async-result'

const UserProfile = (props: { userId: string }) => {
    const userReq = useAsyncResult<User>(async () => {
        const req = await fetch(`/users/${props.userId}`)
        return req.json()
    }, [props.userId])

    if (userReq.isError)
        return <div>Error: {'' + userReq.error}</div>

    if (!userReq.isDone)
        return <div>Loading...</div>

    const user = userReq.result
    return <div>Username: {user.username}</div>
}
```

## Motivating Example

Without the use of libraries, it can be quite complex to correctly handle
asynchronous operations in components. Take, for example, a component nearly
every React developer has likely written at least once in their lives: a
`UserProfile` component.

This is a conceptually simple component: accept a `userId`, load the profile,
show the profile. A simple, happy-path, version of this component can be
written in less than 10 lines:

```tsx
const UserProfile = (props: { userId: string }) => {
    const [user, setUser] = useState<User | null>(null)
    useEffect(() => {
        fetch(`/users/${props.userId}`)
            .then(response => response.json())
            .then(user => setUser(user))
    }, [props.userId])
    return <div>Username: {user?.username}</div>
}
```

But the keen-eyed developer will notice a number of issues with this
implementation:
* No feedback or error messages are displayed if request fails
* An "empty" username will be displayed while the request is loading (instead of
  something more user-friendly, like a "Loading" message)
* There's the possibility of a race condition if the `userId` is changed quickly
  (for example, imagine a request for `/users/1` is loading extremely slowly, and
  while it's loading the `userId` is changed to `2` *and* the request for
  `/users/2` completes quickly; when the request for `/users/1` finally
  completes, the profile of `/user/1` will be displayed instead of `/users/2`).

These issues can, of course, be resolved:

```tsx
const UserProfile = (props: { userId: string }) => {
    const [user, setUser] = useState<User | null>(null)
    const [userError, setUserError] = useState(string | null)(null)
    const [userLastReq, _] = useState({ id: "" })

    useEffect(() => {
        const reqUserId = props.userId
        userLastReq.id = reqUserId
        setUser(null)
        setUserError(null)
        fetch(`/users/${reqUserId}`)
            .then(response => response.json())
            .then(
                user => userLastReq.id == reqUserId && setUser(user),
                error => userLastReq.id == reqUserId && setUserError('' + error),
            )
    }, [props.userId])

    if (userError)
        return <div>Error: {userError}</div>

    if (!user)
        return <div>Loading...</div>

    return <div>Username: {user.username}</div>
}
```

But while this code is *correct*, it isn't *great*:
* The signal-to-nose ratio is low. Of the 20 non-whitespace lines, only 5 are
  doing something specifically related to "showing a user profile"; the other 15
  generic bookkeeping which could be exactly the same for any other component
  which "loads and displays a thing".
* The logical complexity is discordant with the implementational complexity.
  Logically the component is extremely simple: load and display a user's
  profile; even new React developers could reasonably be expected to understand
  this logic. The implementation, on the other hand, is complex: it relies on a
  nuanced understanding of React, closures, and mutability; even experienced
  developers could be forgiven for missing some of this nuance.

`use-async-result` provides a simple, comprehensive, abstraction over asynchronous
operations in React components; it makes correct promise handling
straightforward, and incorrect or incomplete handling difficult.

For example, if the original component was written with `useAsyncResult`, it
might look like this:

```tsx
import { useAsyncResult } from 'react-use-async-result'

const UserProfile = (props: { userId: string }) => {
    const userReq = useAsyncResult<User>(() => {
        return fetch(`/users/${props.userId}`)
            .then(response => response.json())
    }, [props.userId])
    const user = userReq.result
    return <div>Username: {user.username}</div>
}
```

But this will fail to compile, because it assumes the result `isDone`, and
doesn't handle the `pending` or `error` states:

```
const user = userReq.result
                     ^^^^^^
Property 'result' does not exist on type 'UseAsyncResult<User>'.
    Property 'result' does not exist on type 'UseAsyncResultPending<User>'.
```

Which can be addressed by introducing standardized "loading" and "error"
components:

```tsx
// yourapp/components/async-result.tsx
import { AsyncResultError, AsyncResultNotDone } from 'react-use-async-result'

const ResultLoading = () => {
    return <div>Loading...</div>
}

const ResultError = (props: { result: AsyncResultError }) => {
    return <div>Error: {'' + props.result.error}</div>
}

const ResultNotDone = (props: { result: AsyncResultNotDone }) => {
    const { result } = props
    if (result.isError)
        return <ResultError result={result} />
    return <ResultLoading />
}
```

And, in the `UserProfile` component, checking whether the result `isDone` before
using it:

```tsx
// yourapp/components/UserProfile.tsx
const UserProfile = (props: { userId: string }) => {
    // ... snip ...

    if (!userReq.isDone)
        return <ResultNotDone result={result} />

    const user = userReq.result
    return <div>Username: {user.username}</div>
}
```

## Complete Example

This (more) complete examples shows how `useAsyncResult` can be used for both
loading when a component is created, and handling asynchronous requests in
response to user actions.

Notice specifically how the "Save User" button is disabled while the "save"
request is pending, how "save" errors are handled, and how the "save" request is
cleared when a new profile is loaded.

```tsx
import { useAsyncResult } from 'react-use-async-result'

const EditUserProfile = (props: { userId: string }) => {
    const userGetRes = useAsyncResult(async () => {
        userSaveRes.clear()
        const response = await fetch(`/users/${props.userId}`)
        return await response.json()
    }, [props.userId])

    const userSaveRes = useAsyncResult()
    const saveUser = () => {
        userSaveRes.bind(fetch({
            method: 'POST',
            url: `users/${props.userId}`,
            data: {
                username: document.getElementById("username").value,
            },
        }))
    }

    if (!userGetRes.isDone)
        return <ResultNotDone result={userGetRes} />

    const user = userGetRes.result

    return <div>
        Username: <input id="username" defaultValue={user.username} /><br />
        <button disabled={userSaveRes.isPending} onClick={saveUser}>
            Save User
        </button>
        {userSaveRes.isError && <ResultError result={iserSaveRes} />}
    </div>
}
```

## Chaining `AsyncResult`s

Similar to how `Promise`s can be chained by returning a new promise in the
handler to an existing promise, `useAsyncResult` can "chain" `AsyncResult`s.

For example, consider a `UserProfile` component which accepts `userId={null}`
when no user has been selected: an `AsyncResult.empty()` can be used to signal
that the user request is "empty", and will never either "load" or "error":

```tsx
import { useAsyncResult } from 'react-use-async-result'

const UserProfile = (props: { userId: string | null}) => {
    const userReq = useAsyncResult<User>(() => {
        if (!props.userId)
            return AsyncResult.empty()

        // ... snip ...
    }, [props.userId])

    if (userReq.isEmpty)
        return <div>Select a user to view their profile.</div>

    // ... snip ...
}
```

## Type Safety Examples

Below are some examples of the type safety features of `useAsyncResult`.

Results can only be used once the promise has resolved:

```ts
const res = useAsyncResult(...)

console.log(res.result) // error
// example.tsx:1:14 - error TS2339: Property 'result' does not exist on type 'UseAsyncResult<...>'.
//  Property 'result' does not exist on type 'UseAsyncResultPending<...>'.
//
//          result.result // error
//                 ~~~~~~

if (res.isDone)
    console.log(res.result) // ok
```

The result's type will be inferred from the promise's type when possible:

```ts
const res = useAsyncResult(() => userApi.getUser(42))
if (res.isDone)
    console.log(res.result.username) // ok
```

The `AsyncResultNotDone` convenience type can be used to assert that a
result has not yet resolved:

```ts
const showPendingResult = (res: AsyncResultNotDone) => { ... }

const res = useAsyncResult(() => userApi.getUser(42))

showPendingResult(res) // error
// example.tsx:19 - error TS2345: Argument of type 'UseAsyncResult<number>' is not assignable to parameter of type 'AsyncResultNotDone<unknown>'.
//   Type 'UseAsyncResultDone<number>' is not assignable to type 'AsyncResultNotDone<unknown>'.
//
//     showPendingResult(res) // error
//                       ~~~

if (!res.isDone)
    showPendingResult(res) // ok
```