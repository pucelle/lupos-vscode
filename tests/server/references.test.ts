import {describe, expect, it} from 'vitest'
import {createTestLanguageService} from './language-service'


function referencedTexts(
	fileName: string,
	source: string,
	symbols: readonly {references: readonly {fileName: string, textSpan: {start: number, length: number}}[]}[] | undefined
) {
	return (symbols ?? [])
		.flatMap(symbol => symbol.references)
		.filter(reference => reference.fileName === fileName)
		.map(reference => source.slice(reference.textSpan.start, reference.textSpan.start + reference.textSpan.length))
}


describe('server template references from declarations', () => {
	it('includes opening and closing component tags', () => {
		let source = `import {html, Component} from 'lupos.html'
			export class Card extends Component {}
			const view = html\`<Card></Card>\``
		let {service, fileName} = createTestLanguageService(source)
		let symbols = service.findReferences(fileName, source.indexOf('Card extends') + 2)
		let starts = (symbols ?? []).flatMap(symbol => symbol.references)
			.filter(reference => reference.fileName === fileName)
			.map(reference => reference.textSpan.start)

		expect(starts).toContain(source.indexOf('<Card>') + 1)
		expect(starts).toContain(source.indexOf('</Card>') + 2)
		expect(new Set(starts).size).toBe(starts.length)
	})

	it('resolves aliased component tags back to their declaration', () => {
		let source = `import {Component} from 'lupos.html'
			export class Card extends Component {}`
		let consumerFile = 'C:/project/consumer.ts'
		let consumer = `import {html} from 'lupos.html'
			import {Card as LocalCard} from './main'
			const view = html\`<LocalCard></LocalCard>\``
		let {service, fileName} = createTestLanguageService(source, {[consumerFile]: consumer})
		let symbols = service.findReferences(fileName, source.indexOf('Card extends') + 2)
		let starts = (symbols ?? []).flatMap(symbol => symbol.references)
			.filter(reference => reference.fileName === consumerFile)
			.map(reference => reference.textSpan.start)

		expect(starts).toContain(consumer.indexOf('<LocalCard>') + 1)
		expect(starts).toContain(consumer.indexOf('</LocalCard>') + 2)
		expect(new Set(starts).size).toBe(starts.length)
	})

	it('includes only properties belonging to the declared component', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component { title = '' }
			class Dialog extends Component { title = '' }
			const view = html\`<Card .title="card"/><Dialog .title="dialog"/>\``
		let {service, fileName} = createTestLanguageService(source)
		let symbols = service.findReferences(fileName, source.indexOf("title = ''") + 2)
		let starts = (symbols ?? []).flatMap(symbol => symbol.references)
			.filter(reference => reference.fileName === fileName)
			.map(reference => reference.textSpan.start)

		expect(starts).toContain(source.indexOf('.title') + 1)
		expect(starts).not.toContain(source.lastIndexOf('.title') + 1)
	})

	it('includes binding names', () => {
		let source = `import {html, Binding} from 'lupos.html'
			class Show implements Binding {}
			const view = html\`<div :Show />\``
		let {service, fileName} = createTestLanguageService(source)
		let symbols = service.findReferences(fileName, source.indexOf('Show implements') + 2)

		expect(referencedTexts(fileName, source, symbols)).toContain('Show')
		expect((symbols ?? []).flatMap(symbol => symbol.references).map(reference => reference.textSpan.start))
			.toContain(source.indexOf(':Show') + 1)
	})
})


describe('server semantic references from templates', () => {
	it('finds the component declaration and every matching tag', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component {}
			const first = html\`<Card></Card>\`
			const second = html\`<Card />\``
		let {service, fileName} = createTestLanguageService(source)
		let symbols = service.findReferences(fileName, source.indexOf('<Card>') + 2)
		let starts = (symbols ?? []).flatMap(symbol => symbol.references)
			.filter(reference => reference.fileName === fileName)
			.map(reference => reference.textSpan.start)

		expect(starts).toContain(source.indexOf('Card extends'))
		expect(starts).toContain(source.indexOf('<Card>') + 1)
		expect(starts).toContain(source.indexOf('</Card>') + 2)
		expect(starts).toContain(source.lastIndexOf('<Card') + 1)
	})

	it('finds only the resolved component property', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component { title = '' }
			class Dialog extends Component { title = '' }
			const first = html\`<Card .title="one"/><Card .title="two"/>\`
			const other = html\`<Dialog .title="other"/>\``
		let {service, fileName} = createTestLanguageService(source)
		let firstProperty = source.indexOf('.title') + 1
		let symbols = service.findReferences(fileName, firstProperty + 2)
		let starts = (symbols ?? []).flatMap(symbol => symbol.references)
			.filter(reference => reference.fileName === fileName)
			.map(reference => reference.textSpan.start)

		expect(starts).toContain(source.indexOf("title = ''"))
		expect(starts).toContain(firstProperty)
		expect(starts).toContain(source.indexOf('.title', firstProperty + 1) + 1)
		expect(starts).not.toContain(source.lastIndexOf('.title') + 1)
	})

	it('finds the binding declaration and all binding usages', () => {
		let source = `import {html, Binding} from 'lupos.html'
			class Show implements Binding {}
			const first = html\`<div :Show />\`
			const second = html\`<span :Show />\``
		let {service, fileName} = createTestLanguageService(source)
		let symbols = service.findReferences(fileName, source.indexOf(':Show') + 2)
		let starts = (symbols ?? []).flatMap(symbol => symbol.references)
			.filter(reference => reference.fileName === fileName)
			.map(reference => reference.textSpan.start)

		expect(starts).toContain(source.indexOf('Show implements'))
		expect(starts).toContain(source.indexOf(':Show') + 1)
		expect(starts).toContain(source.lastIndexOf(':Show') + 1)
	})
})
