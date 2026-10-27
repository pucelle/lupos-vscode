import {describe, expect, it, vi} from 'vitest'
import {WorkSpaceAnalyzer} from '../../packages/lupos-server/src/lupos-service/analyzer/analyzer'
import {createTestLanguageService} from './language-service'

const Source = `
import {html, Component} from 'lupos.html'
class Card extends Component {
	title = ''
}
const view = html\`<Card></Card>\`
`

describe('server language features', () => {
	it('reuses workspace analysis for repeated completion', () => {
		let source = Source.replace('<Card>', '<Ca>')
		let analyzerUpdate = vi.spyOn(WorkSpaceAnalyzer.prototype, 'update')
		let harness = createTestLanguageService(source)
		let position = source.indexOf('<Ca>') + 3

		harness.service.getCompletionsAtPosition(harness.fileName, position, {})
		harness.service.getCompletionsAtPosition(harness.fileName, position, {})

		expect(analyzerUpdate).toHaveBeenCalledTimes(1)

		let changedSource = source.replace('<Ca>', '<Car>')
		harness.update(changedSource)
		harness.service.getCompletionsAtPosition(
			harness.fileName,
			changedSource.indexOf('<Car>') + 4,
			{}
		)

		expect(analyzerUpdate).toHaveBeenCalledTimes(2)
		analyzerUpdate.mockRestore()
	})

	it('completes workspace components inside a tag name', () => {
		let source = Source.replace('<Card>', '<Ca>')
		let {service, fileName} = createTestLanguageService(source)
		let position = source.indexOf('<Ca>') + 3
		let completions = service.getCompletionsAtPosition(fileName, position, {})

		expect(completions?.entries.some(entry => entry.name === 'Card')).toBe(true)
	})

	it.each([
		{name: 'lu:if', parameters: ' \\${${1}}'},
		{name: 'lu:elseif', parameters: ' \\${${1}}'},
		{name: 'lu:await', parameters: ' \\${${1}}'},
		{name: 'lu:keyed', parameters: ' \\${${1}}'},
		{name: 'lu:switch', parameters: ' \\${${1}}'},
		{name: 'lu:case', parameters: ' \\${${1}}'},
		{name: 'lu:for', parameters: ' \\${${1:item, index}} of \\${${2:list}}'},
		{name: 'lu:else', parameters: ''},
		{name: 'lu:default', parameters: ''},
		{name: 'lu:cache', parameters: ''},
		{name: 'lu:portal', parameters: ''},
	])('completes $name with inputs, an indented body, and a closing tag', ({name, parameters}) => {
		let source = "import {html} from 'lupos.html'\nconst view = html`<lu:>`"
		let position = source.indexOf('<lu:') + 4
		let {service, fileName} = createTestLanguageService(source)
		let completion = service.getCompletionsAtPosition(fileName, position, {})
		let entry = completion?.entries.find(entry => entry.name === name)

		expect(entry?.isSnippet).toBe(true)
		expect(entry?.insertText).toBe(name + parameters + '>\n\t$0\n</' + name)
		expect(entry?.replacementSpan).toEqual({start: source.indexOf('<lu:') + 1, length: 3})
	})

	it.each(['insert', 'replace'])('keeps one closing delimiter when accepting a control snippet in %s mode', mode => {
		let source = "import {html} from 'lupos.html'\nconst view = html`<lu:>`"
		let position = source.indexOf('<lu:') + 4
		let {service, fileName} = createTestLanguageService(source)
		let completion = service.getCompletionsAtPosition(fileName, position, {})
		let entry = completion?.entries.find(entry => entry.name === 'lu:if')

		expect(entry?.isSnippet).toBe(true)
		expect(entry?.replacementSpan).toBeDefined()

		let span = entry!.replacementSpan!
		let end = mode === 'insert' ? position : span.start + span.length
		let result = source.slice(0, span.start) + entry!.insertText + source.slice(end)
		let expected = "import {html} from 'lupos.html'\nconst view = html`<lu:if \\${${1}}>\n\t$0\n</lu:if>`"

		expect(result).toBe(expected)
	})

	it('completes a bare opening angle bracket with a CRLF control snippet', () => {
		let source = "import {html} from 'lupos.html'\r\nconst view = html`\r\n\t<`"
		let position = source.lastIndexOf('<') + 1
		let {service, fileName} = createTestLanguageService(source)
		let completion = service.getCompletionsAtPosition(fileName, position, {})
		let entry = completion?.entries.find(entry => entry.name === 'lu:if')

		expect(entry?.isSnippet).toBe(true)
		expect(entry?.insertText).toBe('lu:if \\${${1}}>\r\n\t$0\r\n</lu:if>')
		expect(entry?.replacementSpan).toEqual({start: position, length: 0})
	})

	it.each([
		'<lu:i|f ${condition}>content</lu:if>',
		'<lu:i|f ${condition}>',
		'<lu:i|f></lu:if>',
		'<lu:i|f />',
	])('preserves existing control tag contents when completing %s', markup => {
		let source = `import {html} from 'lupos.html'\nconst condition = true\nconst view = html\`${markup}\``
		let position = source.indexOf('|')
		let {service, fileName} = createTestLanguageService(source.replace('|', ''))
		let completion = service.getCompletionsAtPosition(fileName, position, {})
		let entry = completion?.entries.find(entry => entry.name === 'lu:if')

		expect(entry?.insertText).toBe('lu:if')
		expect(entry?.isSnippet).toBeUndefined()
	})

	it.each([
		{markup: '<Card .title=${"used"} .| />', excluded: 'title'},
		{markup: '<Card .| .title=${"used"} />', excluded: 'title'},
		{markup: '<Card ..title=${"used"} .| />', excluded: 'title'},
		{markup: '<Card .title=${"used"} ..| />', excluded: 'title'},
		{markup: '<Card .inherited=${"used"} .| />', excluded: 'inherited'},
	])('omits assigned component properties in $markup', ({markup, excluded}) => {
		let source = `import {html, Component} from 'lupos.html'
			class Base extends Component { inherited = '' }
			class Card extends Base { title = ''; size = 0 }
			const view = html\`${markup}\``
		let position = source.indexOf('|')
		let {service, fileName} = createTestLanguageService(source.replace('|', ''))
		let names = service.getCompletionsAtPosition(fileName, position, {})
			?.entries.map(entry => entry.name)

		expect(names).toContain('size')
		expect(names).not.toContain(excluded)
	})

	it.each([
		{markup: '<Card .ti|tle=${"editing"} />', hasTitle: true},
		{markup: '<Card .title=${"used"} .ti|tle=${"editing"} />', hasTitle: false},
		{markup: '<Card .title=${"used"} /><Card .| />', hasTitle: true},
		{markup: '<Card title="attribute" .| />', hasTitle: true},
	])('keeps property completion scoped to other assignments in $markup', ({markup, hasTitle}) => {
		let source = `import {html, Component} from 'lupos.html'
			class Card extends Component { title = '' }
			const view = html\`${markup}\``
		let position = source.indexOf('|')
		let {service, fileName} = createTestLanguageService(source.replace('|', ''))
		let names = service.getCompletionsAtPosition(fileName, position, {})
			?.entries.map(entry => entry.name)

		expect(names?.includes('title')).toBe(hasTitle)
	})

	it('returns quick info and a definition for a component tag', () => {
		let {service, fileName} = createTestLanguageService(Source)
		let position = Source.indexOf('<Card>') + 2
		let quickInfo = service.getQuickInfoAtPosition(fileName, position)
		let definition = service.getDefinitionAndBoundSpan(fileName, position)

		expect(quickInfo?.textSpan.length).toBe(4)
		expect(definition?.definitions?.[0].fileName).toBe(fileName)
		expect(definition?.definitions?.[0].textSpan.start).toBe(Source.indexOf('Card extends'))
	})

	it('returns both definitions for a component event name', () => {
		let source = `
import {html, Component} from 'lupos.html'
interface CardEvents {
	save: string
}
class Card extends Component<CardEvents> {}
const view = html\`<Card @save=\${event => event} />\`
`
		let {service, fileName} = createTestLanguageService(source)
		let position = source.indexOf('@save') + 2
		let eventDeclaration = source.indexOf('save: string')
		let definitions = service.getDefinitionAtPosition(fileName, position)
		let definitionAndSpan = service.getDefinitionAndBoundSpan(fileName, position)

		expect(definitions?.[0].fileName).toBe(fileName)
		expect(definitions?.[0].textSpan.start).toBe(eventDeclaration)
		expect(definitionAndSpan?.definitions?.[0].textSpan.start).toBe(eventDeclaration)
		expect(definitionAndSpan?.textSpan).toEqual({
			start: source.indexOf('@save'),
			length: 5,
		})
	})
})
