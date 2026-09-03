import {describe, expect, it} from 'vitest'
import {createTestLanguageService} from './language-service'


function renamedTexts(source: string, locations: readonly {fileName: string, textSpan: {start: number, length: number}}[]) {
	return locations
		.filter(location => location.fileName === 'C:/project/main.ts')
		.map(location => source.slice(location.textSpan.start, location.textSpan.start + location.textSpan.length))
}

function renamedTextsIn(
	fileName: string,
	source: string,
	locations: readonly {fileName: string, textSpan: {start: number, length: number}}[]
) {
	return locations
		.filter(location => location.fileName === fileName)
		.map(location => source.slice(location.textSpan.start, location.textSpan.start + location.textSpan.length))
}


describe('server template rename', () => {
	it('renames component tags when started from the declaration', () => {
		let source = `import {html, Component} from 'lupos.html'
			export class Card extends Component {}
			const view = html\`<Card></Card>\``
		let {service, fileName} = createTestLanguageService(source)
		let position = source.indexOf('Card extends') + 2
		let info = service.getRenameInfo(fileName, position, {})
		let locations = service.findRenameLocations(fileName, position, false, false, {})!
		let starts = locations.map(location => location.textSpan.start)

		expect(info.canRename).toBe(true)
		expect(starts).toContain(source.indexOf('<Card>') + 1)
		expect(starts).toContain(source.indexOf('</Card>') + 2)
	})

	it('renames component properties when started from the declaration', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component { title = '' }
			class Dialog extends Component { title = '' }
			const view = html\`<Card .title="card"/><Dialog .title="dialog"/>\``
		let {service, fileName} = createTestLanguageService(source)
		let position = source.indexOf("title = ''") + 2
		let locations = service.findRenameLocations(fileName, position, false, false, {})!
		let starts = locations.map(location => location.textSpan.start)

		expect(starts).toContain(source.indexOf('.title') + 1)
		expect(starts).not.toContain(source.lastIndexOf('.title') + 1)
	})

	it('renames bindings when started from the declaration', () => {
		let source = `import {html, Binding} from 'lupos.html'
			class Show implements Binding {}
			const view = html\`<div :Show />\``
		let {service, fileName} = createTestLanguageService(source)
		let position = source.indexOf('Show implements') + 2
		let locations = service.findRenameLocations(fileName, position, false, false, {})!

		expect(locations.map(location => location.textSpan.start)).toContain(source.indexOf(':Show') + 1)
	})

	it('preserves local component aliases when renaming the exported declaration', () => {
		let source = `import {Component} from 'lupos.html'
			export class Card extends Component {}`
		let consumerFile = 'C:/project/consumer.ts'
		let consumer = `import {html} from 'lupos.html'
			import {Card as LocalCard} from './main'
			const view = html\`<LocalCard></LocalCard>\``
		let {service, fileName} = createTestLanguageService(source, {[consumerFile]: consumer})
		let position = source.indexOf('Card extends') + 2
		let locations = service.findRenameLocations(fileName, position, false, false, {})!

		expect(renamedTextsIn(consumerFile, consumer, locations)).toEqual(['Card'])
	})

	it('renames a component declaration and both template tags', () => {
		let source = `import {html, Component} from 'lupos.html'
			export class Card extends Component {}
			const view = html\`<Card></Card>\``
		let {service, fileName} = createTestLanguageService(source)
		let position = source.indexOf('<Card>') + 2
		let info = service.getRenameInfo(fileName, position, {})
		let locations = service.findRenameLocations(fileName, position, false, false, {})!

		expect(info).toEqual(expect.objectContaining({
			canRename: true,
			triggerSpan: {start: source.indexOf('<Card>') + 1, length: 4},
		}))
		expect(renamedTexts(source, locations)).toEqual(['Card', 'Card', 'Card'])
	})

	it('renames only the property name, excluding its prefix', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component { title = '' }
			const view = html\`<Card .title="heading" />\``
		let {service, fileName} = createTestLanguageService(source)
		let position = source.indexOf('.title') + 2
		let info = service.getRenameInfo(fileName, position, {})
		let locations = service.findRenameLocations(fileName, position, false, false, {})!

		expect(info.canRename && info.triggerSpan).toEqual({start: source.indexOf('.title') + 1, length: 5})
		expect(renamedTexts(source, locations)).toEqual(['title', 'title'])
	})

	it('renames a binding declaration and template binding name', () => {
		let source = `import {html, Binding} from 'lupos.html'
			class Show implements Binding {}
			const view = html\`<div :Show />\``
		let {service, fileName} = createTestLanguageService(source)
		let position = source.indexOf(':Show') + 2
		let info = service.getRenameInfo(fileName, position, {})
		let locations = service.findRenameLocations(fileName, position, false, false, {})!

		expect(info.canRename && info.triggerSpan).toEqual({start: source.indexOf(':Show') + 1, length: 4})
		expect(renamedTexts(source, locations)).toEqual(['Show', 'Show'])
	})

	it('denies rename when a reference is in node_modules', () => {
		let source = `import {html, Component} from 'lupos.html'
			export class Card extends Component {}
			const view = html\`<Card />\``
		let dependencyFile = 'C:/project/node_modules/example/index.ts'
		let dependency = `import {Card} from '../../main'; export const card = Card`
		let {service, fileName} = createTestLanguageService(source, {[dependencyFile]: dependency})
		let position = source.indexOf('<Card') + 2
		let declarationPosition = source.indexOf('Card extends') + 2

		expect(service.getRenameInfo(fileName, position, {})).toEqual({
			canRename: false,
			localizedErrorMessage: 'Cannot rename this symbol because it has references in node_modules.',
		})
		expect(service.findRenameLocations(fileName, position, false, false, {})).toBeUndefined()
		expect(service.getRenameInfo(fileName, declarationPosition, {})).toEqual({
			canRename: false,
			localizedErrorMessage: 'Cannot rename this symbol because it has references in node_modules.',
		})
		expect(service.findRenameLocations(fileName, declarationPosition, false, false, {})).toBeUndefined()
	})

	it('follows TypeScript alias semantics across files', () => {
		let source = `import {Component} from 'lupos.html'
			export class Card extends Component {}`
		let consumerFile = 'C:/project/consumer.ts'
		let consumer = `import {html} from 'lupos.html'
			import {Card as LocalCard} from './main'
			const view = html\`<LocalCard></LocalCard>\``
		let {service} = createTestLanguageService(source, {[consumerFile]: consumer})
		let position = consumer.indexOf('<LocalCard>') + 2
		let locations = service.findRenameLocations(consumerFile, position, false, false, {})!

		expect(renamedTextsIn(consumerFile, consumer, locations)).toEqual(['LocalCard', 'LocalCard', 'LocalCard'])
		expect(renamedTextsIn('C:/project/main.ts', source, locations)).toEqual([])
	})

	it('does not rename an equally named property on an unrelated component', () => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component { title = '' }
			class Dialog extends Component { title = '' }
			const view = html\`<Card .title="card"/><Dialog .title="dialog"/>\``
		let {service, fileName} = createTestLanguageService(source)
		let position = source.indexOf('.title') + 2
		let locations = service.findRenameLocations(fileName, position, false, false, {})!
		let starts = locations.map(location => location.textSpan.start)

		expect(starts).toContain(source.indexOf("title = ''"))
		expect(starts).toContain(source.indexOf('.title') + 1)
		expect(starts).not.toContain(source.lastIndexOf("title = ''"))
		expect(starts).not.toContain(source.lastIndexOf('.title') + 1)
	})

	it('falls back to TypeScript rename inside an interpolation', () => {
		let source = `import {html} from 'lupos.html'
			const title = 'hello'
			const view = html\`<div>\${title}</div>\``
		let {service, fileName} = createTestLanguageService(source)
		let position = source.lastIndexOf('title') + 2
		let locations = service.findRenameLocations(fileName, position, false, false, {})!

		expect(renamedTexts(source, locations)).toEqual(['title', 'title'])
	})
})
