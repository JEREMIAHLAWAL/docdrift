# Upgrade guide fixture (provisional)

Hand-written in the shape we expect from Firecrawl. Replace with a trimmed
real scrape once the `firecrawl/scrape` probe has run.

### Removed deprecated React DOM APIs [Link for Removed deprecated React DOM APIs](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-deprecated-react-dom-apis "Link for Removed deprecated React DOM APIs")

#### Removed: `ReactDOM.render` [Link for this heading](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-reactdom-render "Link for this heading")

`ReactDOM.render` was deprecated in [March 2022 (v18.0.0)](https://react.dev/blog/2022/03/08/react-18-upgrade-guide). In React 19, we’re removing `ReactDOM.render` and you’ll need to migrate to using [`ReactDOM.createRoot`](https://react.dev/reference/react-dom/client/createRoot):

```js
// Before
import {render} from 'react-dom';
render(<App />, document.getElementById('root'));

// After
import {createRoot} from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

#### Removed: `ReactDOM.hydrate` [Link for this heading](https://react.dev/blog/2024/04/25/react-19-upgrade-guide#removed-reactdom-hydrate "Link for this heading")

`ReactDOM.hydrate` was deprecated in March 2022 (v18.0.0).
