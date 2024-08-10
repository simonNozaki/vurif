import Mustache from 'mustache'
import path from 'path'
import fs from 'fs'
import { Printer } from '../printer'
import { Node } from '../node'
import { ElementDefinition, NodeDefinition } from 'cytoscape'
import startServer from './graph-server/server'
import { ComponentRegistry } from 'src/registry'
import { VueFile } from '../vue-file'
import { VueFileName, toStaticPath } from '../util'

/**
 * Create data representing a node
 */
function createNodeDef(name: VueFileName): NodeDefinition {
  return {
    data: { id: name, }
  }
}

/**
 * Create data representing a edge connecting nodes
 */
function createEdgeDef(source: VueFileName, target: VueFileName): NodeDefinition {
  return {
    data: {
      id: `${source}-${target}`,
      source: source,
      target: target
    }
  }
}

function writeJavaScript(data: any[]): void {
  // TODO: ファイルの読み書きを待たない
  const template = fs.readFileSync(toStaticPath('cy.client.js.template'))

  const output = Mustache.render(template.toString(), {
    elements: JSON.stringify(data)
  })

  const jsPath = path.join('cy.client.js')

  if (fs.existsSync(jsPath)) {
    fs.rmSync(jsPath)
  }

  fs.writeFileSync(jsPath, output, { encoding: 'utf-8' })
}

export class VisualGraphPrinter implements Printer {
  private completedHandler: () => void
  constructor(private registry: ComponentRegistry) {}

  print(node: Node): void {
    const elements = this.createGraphElement(node)

    writeJavaScript(elements)

    startServer(this.completedHandler)
  }

  onCompleted(handler: () => void): this {
    this.completedHandler = handler
    return this
  }

  /**
   * Create graph elements(nodes and edges).
   */
  private createGraphElement(node: Node): ElementDefinition[] {
    const name = VueFile
      .fromOriginal(this.registry.get(node.name))
      .vueFileName
    const nodeDef = createNodeDef(name)

    if (!node.hasEdges()) return [nodeDef]

    const childNodeDefs = Object.entries(node.edges).map((edge: [name: string, n: Node]) => {
      const childNode = edge[1]
      // create a edge leading to child node
      const parentName = VueFile
        .fromOriginal(this.registry.get(node.name))
        .vueFileName
      const childName = VueFile
        .fromOriginal(this.registry.get(childNode.name))
        .vueFileName
      const edgeDef = createEdgeDef(parentName, childName)
      const childNodeDefs = this.createGraphElement(childNode)

      return [edgeDef, ...childNodeDefs]
    })

    return [...childNodeDefs, nodeDef].flat()
  }
}
