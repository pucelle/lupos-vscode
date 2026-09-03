import {describe, expect, it} from 'vitest'
import ts from 'typescript'
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

	it('reports mismatched and unclosed HTML syntax from the shared module', () => {
		let source = `import {html} from 'lupos.html'
			const mismatched = html\`<div></span>\`
			const unclosed = html\`<section>\``
		let {service, fileName} = createTestLanguageService(source)
		let diagnostics = service.getSemanticDiagnostics(fileName)

		expect(diagnostics).toEqual(expect.arrayContaining([
			expect.objectContaining({
				code: 30005,
				category: ts.DiagnosticCategory.Warning,
				messageText: "Closing tag '</span>' does not match opening tag '<div>'.",
			}),
			expect.objectContaining({
				code: 30006,
				category: ts.DiagnosticCategory.Warning,
				messageText: "Tag '<section>' is not closed.",
			}),
		]))
	})

	it('requires a root template to be the function only return value', () => {
		let source = `import {html} from 'lupos.html'
			function render(alternate: boolean) {
				if (alternate) return html\`<template></template>\`
				return html\`<div></div>\`
			}`
		let {service, fileName} = createTestLanguageService(source)
		let diagnostics = service.getSemanticDiagnostics(fileName)

		expect(diagnostics).toContainEqual(expect.objectContaining({
			code: 30007,
			messageText: "A function that returns '<template>' must use it as its only return value.",
		}))
	})

	it('allows a root template when it is the function only return value', () => {
		let source = `import {html} from 'lupos.html'
			const render = () => html\`<template></template>\``
		let {service, fileName} = createTestLanguageService(source)
		let diagnostics = service.getSemanticDiagnostics(fileName)

		expect(diagnostics.some(diagnostic => diagnostic.code === 30007)).toBe(false)
	})
})
