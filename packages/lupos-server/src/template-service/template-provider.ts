import type * as TS from 'typescript'
import {Template} from './template'
import {ts, ProjectContext, PluginConfig} from '../core'
import {ScopeTree, WeakerPairKeysMap} from '../lupos-ts-module'


/** 
 * It helps to query template at specified position,
 * and make `Template` instances.
 */
export class TemplateProvider {

	readonly context: ProjectContext
	private sourceFileCache: SourceFileCache = new SourceFileCache()
	private templateCache: TemplateCache
	private scopeTreeCache: ScopeTreeCache

	constructor(context: ProjectContext) {
		this.context = context
		this.templateCache = new TemplateCache(this.sourceFileCache)
		this.scopeTreeCache = new ScopeTreeCache(this.sourceFileCache)
	}

	/** Get a Template from specified offset position of source file. */
	getTemplateAt(fileName: string, offset: number): Template | null {
		let sourceFile = this.context.program.getSourceFile(fileName)
		let taggedNode = this.getTaggedNodeAt(fileName, offset)

		if (!sourceFile || !taggedNode) {
			return null
		}

		let template = this.templateCache.get(sourceFile, taggedNode)
		if (!template) {
			template = this.createTemplate(taggedNode)
			this.templateCache.add(sourceFile, taggedNode, template)
		}

		return template
	}

	/** Get template node, but limit only the literal part. */
	private getTaggedNodeAt(fileName: string, offset: number): TS.TaggedTemplateExpression | null {
		let sourceFile = this.context.program.getSourceFile(fileName)
		let currentNode = sourceFile ? this.context.helper.getNodeAtOffset(sourceFile, offset) : undefined
		if (!currentNode) {
			return null
		}

		// Find html`...`
		let taggedNode = this.context.helper.findOutward(currentNode, ts.isTaggedTemplateExpression)

		// Must recheck tag kind.
		if (!taggedNode) {
			return null
		}

		// Check tag name is allowed.
		if (!this.isConfiguredTagName(taggedNode.tag)) {
			return null
		}

		return taggedNode
	}

	/** Test whether be `html, css, svg` tag. */
	private isConfiguredTagName(tag: TS.Expression): boolean {
		let text = tag.getText()
		let lastPart = text.match(/\w+$/)?.[0]

		if (!lastPart || !PluginConfig.tags.includes(lastPart)) {
			return false
		}

		return this.context.helper.symbol.isImportedFrom(tag, lastPart, '@pucelle/lupos.js')
	}

	private createTemplate(taggedNode: TS.TaggedTemplateExpression) {
		let templateLiteral = taggedNode.template
		let tagName = taggedNode.tag.getText() as 'html' | 'css' | 'svg'
		let scopeTree = this.getScopeTreeBy(taggedNode.getSourceFile())

		return new Template(
			tagName,
			templateLiteral,
			scopeTree,
			this.context,
		)
	}

	/** Get all Template from source file. */
	getAllTemplates(fileName: string): Template[] {
		let sourceFile = this.context.program.getSourceFile(fileName)
		if (!sourceFile) {
			return []
		}

		let taggedNodes = this.context.helper.findAllInward(sourceFile, ts.isTaggedTemplateExpression)
		taggedNodes = taggedNodes.filter(node => this.isConfiguredTagName(node.tag))

		return taggedNodes.map(node => this.createTemplate(node))
	}

	/** Get ScopeTree from specified source file. */
	getScopeTreeBy(sourceFile: TS.SourceFile): ScopeTree {
		let scopeTree = this.scopeTreeCache.get(sourceFile)

		if (!scopeTree) {
			scopeTree = this.createScopeTree(sourceFile)
			this.scopeTreeCache.add(sourceFile, scopeTree)
		}

		return scopeTree
	}

	private createScopeTree(sourceFile: TS.SourceFile) {
		let scopeTree = new ScopeTree(this.context.helper)
		scopeTree.visitSourceFile(sourceFile)

		return scopeTree
	}
}


/** 
 * If source file not changed, can know cache is valid.
 * If source file not touched for 5 minutes, clear cache.
 */
class SourceFileCache {

	private cachedSize: WeakMap<TS.SourceFile, number> = new WeakMap()
	private timeouts: WeakMap<TS.SourceFile, NodeJS.Timeout> = new WeakMap()

	cache(sourceFile: TS.SourceFile) {
		this.cachedSize.set(sourceFile, sourceFile.getFullWidth())
		this.resetTimeout(sourceFile)
	}

	isValid(sourceFile: TS.SourceFile): boolean {
		if (!this.cachedSize.has(sourceFile)) {
			return false
		}

		// I believe there should be a better way to check document version!
		let oldSize = this.cachedSize.get(sourceFile)
		let newSize = sourceFile.getFullWidth()
		let changed = oldSize !== newSize

		if (changed) {
			this.clearCache(sourceFile)
			return false
		}

		return true
	}

	private resetTimeout(sourceFile: TS.SourceFile) {
		let timeout = this.timeouts.get(sourceFile)
		if (timeout) {
			clearTimeout(timeout)
			timeout = setTimeout(() => this.clearCache(sourceFile), 5 * 60 * 1000)
			this.timeouts.set(sourceFile, timeout)	
		}
	}

	private clearCache(sourceFile: TS.SourceFile) {
		this.cachedSize.delete(sourceFile)
		this.timeouts.delete(sourceFile)
	}
}


/** 
 * If source file not changed, can keep scope in cache.
 * If source file not touched for 5 minutes, clear cache.
 */
class ScopeTreeCache {

	readonly sourceFileCache: SourceFileCache
	private cache: WeakMap<TS.SourceFile, ScopeTree> = new WeakMap()

	constructor(sourceFileCache: SourceFileCache) {
		this.sourceFileCache = sourceFileCache
	}

	get(sourceFile: TS.SourceFile): ScopeTree | undefined {
		if (!this.sourceFileCache.isValid(sourceFile)) {
			return undefined
		}

		return this.cache.get(sourceFile)
	}

	add(sourceFile: TS.SourceFile, scopeTree: ScopeTree) {
		this.cache.set(sourceFile, scopeTree)
		this.sourceFileCache.cache(sourceFile)
	}
}


/** 
 * If source file not changed, can keep template in cache.
 * If source file not touched for 5 minutes, clear cache.
 */
class TemplateCache {

	readonly sourceFileCache: SourceFileCache
	private cache: WeakerPairKeysMap<TS.SourceFile, TS.TaggedTemplateExpression, Template> = new WeakerPairKeysMap()

	constructor(sourceFileCache: SourceFileCache) {
		this.sourceFileCache = sourceFileCache
	}

	get(sourceFile: TS.SourceFile, taggedNode: TS.TaggedTemplateExpression): Template | undefined {
		if (!this.sourceFileCache.isValid(sourceFile)) {
			return undefined
		}

		return this.cache.get(sourceFile, taggedNode)
	}

	add(sourceFile: TS.SourceFile, taggedNode: TS.TaggedTemplateExpression, template: Template) {
		this.cache.set(sourceFile, taggedNode, template)
		this.sourceFileCache.cache(sourceFile)
	}
}
