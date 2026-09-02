import {describe, expect, it} from 'vitest'
import {createTestLanguageService, diagnosticMessages} from './language-service'

describe('server semantic diagnostics', () => {
	it('reports one diagnostic for one missing component', () => {
		let source = `import {html} from 'lupos.html'\nconst view = html\`<Missing></Missing>\``
		let {service, fileName} = createTestLanguageService(source)
		let messages = diagnosticMessages(service.getSemanticDiagnostics(fileName))
		let missing = messages.filter(message => message === "Component '<Missing>' is not existing.")

		expect(missing).toHaveLength(1)
	})

	it('keeps diagnostics stable across repeated requests', () => {
		let source = `import {html} from 'lupos.html'\nconst view = html\`<Missing />\``
		let {service, fileName} = createTestLanguageService(source)

		expect(diagnosticMessages(service.getSemanticDiagnostics(fileName))).toEqual(
			diagnosticMessages(service.getSemanticDiagnostics(fileName))
		)
	})

	it('refreshes after an equal-length edit', () => {
		let source = `import {html, Component} from 'lupos.html'\nclass Present extends Component {}\nconst view = html\`<Missing />\``
		let harness = createTestLanguageService(source)
		expect(diagnosticMessages(harness.service.getSemanticDiagnostics(harness.fileName)))
			.toContain("Component '<Missing>' is not existing.")

		harness.update(source.replace('Missing', 'Present'))
		expect(diagnosticMessages(harness.service.getSemanticDiagnostics(harness.fileName)))
			.not.toContain("Component '<Present>' is not existing.")
	})
})
