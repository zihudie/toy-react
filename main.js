import { createElement, render, Component } from './toy-react'

class MyComponent extends Component {

  render() {
    return (
      <div>
        <div>my component</div>
        {this.children}
      </div>
    )
  }
}

render(<MyComponent id="my" class="cur">
  <div>abc</div>
  <div></div>
  <div></div>
</MyComponent>, document.body)
