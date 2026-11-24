### Removed deprecated React DOM APIs {/*removed-deprecated-react-dom-apis*/}

#### Removed: `react-dom/test-utils` {/*removed-react-dom-test-utils*/}

We've moved `act` from `react-dom/test-utils` to the `react` package:

<ConsoleBlockMulti>

<ConsoleLogLine level="error">

`ReactDOMTestUtils.act` is deprecated in favor of `React.act`. Import `act` from `react` instead of `react-dom/test-utils`. See https://react.dev/warnings/react-dom-test-utils for more info.

</ConsoleLogLine>

</ConsoleBlockMulti>

To fix this warning, you can import `act` from `react`:

```diff
- import {act} from 'react-dom/test-utils'
+ import {act} from 'react';
```

All other `test-utils` functions have been removed. These utilities were uncommon, and made it too easy to depend on low level implementation details of your components and React. In React 19, these functions will error when called and their exports will be removed in a future version.

See the [warning page](https://react.dev/warnings/react-dom-test-utils) for alternatives.

<Note>

Codemod `ReactDOMTestUtils.act` to `React.act`:

```bash
npx codemod@latest react/19/replace-act-import
```

</Note>

#### Removed: `ReactDOM.render` {/*removed-reactdom-render*/}

`ReactDOM.render` was deprecated in [March 2022 (v18.0.0)](https://react.dev/blog/2022/03/08/react-18-upgrade-guide). In React 19, we're removing `ReactDOM.render` and you'll need to migrate to using [`ReactDOM.createRoot`](https://react.dev/reference/react-dom/client/createRoot):

```js
// Before
import {render} from 'react-dom';
render(<App />, document.getElementById('root'));

// After
import {createRoot} from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

<Note>

Codemod `ReactDOM.render` to `ReactDOMClient.createRoot`:

```bash
npx codemod@latest react/19/replace-reactdom-render
```

</Note>

#### Removed: `ReactDOM.hydrate` {/*removed-reactdom-hydrate*/}

`ReactDOM.hydrate` was deprecated in [March 2022 (v18.0.0)](https://react.dev/blog/2022/03/08/react-18-upgrade-guide). In React 19, we're removing `ReactDOM.hydrate` you'll need to migrate to using [`ReactDOM.hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot),

```js
// Before
import {hydrate} from 'react-dom';
hydrate(<App />, document.getElementById('root'));

// After
import {hydrateRoot} from 'react-dom/client';
hydrateRoot(document.getElementById('root'), <App />);
```

<Note>

Codemod `ReactDOM.hydrate` to `ReactDOMClient.hydrateRoot`:

```bash
npx codemod@latest react/19/replace-reactdom-render
```

</Note>

