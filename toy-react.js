const RANDER_TO_DOM = Symbol("range to dom")

export class Component {
  constructor() {
    this.props = Object.create(null)
    this.children = []
    this._root = null
    this._range = null
    this._vdom = null
  }
  get vdom() {
    return this.render().vdom
  }
  setAttribute(name, value) {
    this.props[name] = value
  }
  appendChild(component) {
    this.children.push(component)
  }
  [RANDER_TO_DOM](range) {
    this._range = range
    this._vdom = this.vdom
    this._vdom[RANDER_TO_DOM](range)
  }
  update() { // VDOM比对  diff算法
    let isSameNode = (oldNode, newNode) => {
      if (oldNode.type !== newNode.type) { // 类型不同
        return false
      }
      for (let name in newNode.props) {
        if (newNode.props[name] !== oldNode.props[name]) { // 属性不同
          return false
        }
      }
      if (Object.keys(oldNode.props).length > Object.keys(newNode.props).length) { // 属性的数量不同
        return false
      }
      if (newNode.type === '#text') { // 文本的内容不同
        if (newNode.content !== oldNode.content) {
          return false
        }
      }
      return true
    }
    let update = (oldNode, newNode) => {
      if (!isSameNode(oldNode, newNode)) { // 如果节点不同 直接replace
        newNode[RANDER_TO_DOM](oldNode._range)
        return
      }
      newNode._range = oldNode._range // 必须确保node为elementwrapper才能如此赋值
      let newChildren = newNode.vchildren // 如果写children的话获取的是Component的children
      let oldChildren = oldNode.vchildren
      if (!newChildren || !newChildren.length) {
        return
      }
      let tailRange = oldChildren[oldChildren.length - 1]._range
      for (let i = 0; i < newChildren.length; i++) {
        let newChild = newChildren[i]
        let oldChild = oldChildren[i]
        if (i < oldChildren.length) {
          update(oldChild, newChild)
        } else {
          // todo
          let range = document.createRange()
          range.setStart(tailRange.endContainer, tailRange.endOffset)
          range.setEnd(tailRange.endContainer, tailRange.endOffset)
          newChild[RANDER_TO_DOM](range)
          tailRange = range
        }
      }
    }
    let vdom = this.vdom
    update(this._vdom, vdom)
    this._vdom = vdom
  }
  setState(newState) {
    if (this.state === null || typeof this.state !== 'object') {
      this.state = newState
      this.update()
      return
    }
    let merge = (oldState, newState) => {
      for (let key in newState) {
        if (oldState[key] === null || typeof oldState[key] !== 'object') {
          oldState[key] = newState[key]
        } else {
          merge(oldState[key], newState[key])
        }
      }
    }
    merge(this.state, newState)
    this.update()
  }
}
class ElementWrapper extends Component {
  constructor(type) {
    super(type)
    this.type = type
  }
  get vdom() {
    this.vchildren = this.children.map(child => child.vdom)
    return this
  }
  [RANDER_TO_DOM](range) { // 基于虚拟dom生成实体dom
    this._range = range;
    let root = document.createElement(this.type)
    for (let name in this.props) { // 为dom添加属性
      let value = this.props[name]
      if (name.match(/^on([\s\S]+)$/)) { // \s所有空白 \S所有非空白 结合在一起表示所有字符 ()匹配模式  RegExp.$1表示匹配到的值 支持on*写法,用来绑定事件
        root.addEventListener(RegExp.$1.replace(/^[\s\S]/, word => word.toLowerCase()), value) // 有时为驼峰式onClick，RegExp.$1 为Click，需要确保首字母小写，事件大小写敏感
      } else {
        if (name === 'className') {
          root.setAttribute('class', value)
        } else {
          root.setAttribute(name, value)
        }
      }
    }
    if (!this.vchildren) this.vchildren = this.children.map(child => child.vdom)
    for (let child of this.vchildren) { // 每个child实际上是个Component 
      let childRange = document.createRange()
      childRange.setStart(root, root.childNodes.length) // 这里起始节点必须为最后才对应添加节点
      childRange.setEnd(root, root.childNodes.length)
      child[RANDER_TO_DOM](childRange)
    }
    replaceContent(range, root)
  }
}

class TextWrapper extends Component {
  constructor(content) {
    super(content)
    this.type = '#text'
    this.content = content
  }
  get vdom() {
    return this
  }
  [RANDER_TO_DOM](range) {
    this._range = range;
    let root = document.createTextNode(this.content)
    replaceContent(range, root)
  }
}

function replaceContent(range, node) { // 抽象空range统一处理逻辑
  range.insertNode(node) // 插入之后node出现在range最前面
  range.setStartAfter(node)
  range.deleteContents()
  range.setStartBefore(node)
  range.setEndAfter(node)
}

export function createElement(type, attributes, ...children) {
  let element;
  if (typeof type === 'string') {
    element = new ElementWrapper(type)
  } else {
    element = new type
  }
  for (let attr in attributes) {
    element.setAttribute(attr, attributes[attr])
  }
  let insertChildren = (children) => {
    for (let child of children) {
      if (typeof child === 'string') {
        child = new TextWrapper(child)
      }
      if (child === null) {
        continue
      }
      if ((typeof child === 'object') && (child instanceof Array)) { // 判断child是否为数组 需要考虑到数组嵌套情况 所以需要递归展开
        insertChildren(child)
      } else { // insertChildren的时候无需append
        element.appendChild(child)
      }
    }
  }
  insertChildren(children)
  return element
}

export function render(component, parentElement) {
  let range = document.createRange()
  range.setStart(parentElement, 0)
  range.setEnd(parentElement, parentElement.childNodes.length)
  range.deleteContents()
  component[RANDER_TO_DOM](range)
}