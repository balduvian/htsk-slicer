type Section = {
	supersection: number;
	subsection: number;
	titleElement: Element | undefined;
	bodyElements: Element[];
};

type BuildingSection = {
	supersection: number;
	subsection: number;
	titleElement: Element | undefined;
	bodyElements: Element[];
};

const allElements = (section: Section) => {
	return section.titleElement === undefined
		? section.bodyElements
		: [section.titleElement, ...section.bodyElements];
};

const funErr = (msg: string) => {
	throw msg;
};

const grabContent = () => {
	const mainContainer =
		document.getElementById('main') ?? funErr('Page contains no main');
	const content =
		mainContainer?.firstElementChild?.firstElementChild
			?.firstElementChild ?? funErr('Improper main tree found');

	return content instanceof HTMLElement
		? content
		: funErr('Content is not an element');
};

const grabLessonNumber = () => {
	const titlebar =
		document.getElementById('page-titlebar') ??
		funErr('Page contains no title');

	const title =
		titlebar.firstElementChild?.firstElementChild?.textContent ??
		funErr('Improper titlebar found');

	const lessonNumber = +title.split(/[ :]/)[1];

	return Number.isNaN(lessonNumber)
		? funErr("Can't find lesson number")
		: lessonNumber;
};

const cleanPage = (content: Element) => {
	[
		...content.getElementsByTagName('script'),
		...content.getElementsByTagName('ins'),
		...document.getElementsByClassName('play-button'),
	].forEach(element => element.remove());
};

const justLetters = (text: String) =>
	text.toLowerCase().replace(/[^(a-z )]/g, '');

const autoModifierTag = (content: HTMLElement) => {
	const contentList = [...content.children];

	const isIntroduction = (element: Element) => {
		const text = justLetters(element.textContent!);

		return (
			text.startsWith('introduction') ||
			text.startsWith('this lesson is also available') ||
			text.includes('memrise tool')
		);
	};

	const isPracticeLink = (element: Element) => {
		let foundImg = false;

		for (const child of element.children) {
			if (child.nodeName === 'A') {
				for (const child2 of child.children) {
					if (child2.nodeName === 'IMG') foundImg = true;
				}
			}
		}

		return foundImg && element.textContent!.trim() !== '';
	};

	const isCloser = (element: Element) => {
		const text = justLetters(element.textContent!);

		return (
			text.startsWith('thats it for this lesson') ||
			text.startsWith('thats it for lesson') ||
			text.startsWith('okay i got it') ||
			text.startsWith('click here for a workbook') ||
			(text.startsWith('there are') &&
				text.includes('example sentences in unit')) ||
			text.startsWith('all entries are linked to an audio file')
		);
	};

	const isVocab = (element: Element) => {
		const header = element.firstElementChild;

		if (
			header !== null &&
			(header.nodeName === 'U' ||
				(header as HTMLElement).style.textDecoration === 'underline')
		) {
			const text = justLetters(header.textContent!);

			if (
				text.startsWith('nouns') ||
				text.startsWith('verb') ||
				text.startsWith('adjectives') ||
				text.startsWith('adverbs') ||
				text.startsWith('vocabulary')
			)
				return true;
		}

		return false;
	};

	for (const element of contentList) {
		if (
			isIntroduction(element) ||
			isPracticeLink(element) ||
			isVocab(element)
		) {
			element.classList.add(POISON_CLASS_NAME);
		} else if (isCloser(element)) {
			element.classList.add(DISREGARD_CLASS_NAME);
		}
	}
};

const parseSections = (content: HTMLElement) => {
	const contentList = [...content.children];
	const sections: Section[] = [];

	let buildingSection: BuildingSection = {
		supersection: 0,
		subsection: 1,
		titleElement: undefined,
		bodyElements: [],
	};

	const saveSection = (building: BuildingSection) => {
		/* the only check for if the section is complete (it has body elements) */
		if (building.bodyElements.length === 0) return;

		/* remove disregarded elements */
		if (building.titleElement?.classList.contains(DISREGARD_CLASS_NAME))
			building.titleElement = undefined;
		building.bodyElements = building.bodyElements.filter(
			element => !element.classList.contains(DISREGARD_CLASS_NAME),
		);

		/* poison means do not add to sections list */
		if (
			building.bodyElements.length > 0 &&
			!building.titleElement?.classList.contains(POISON_CLASS_NAME) &&
			building.bodyElements.every(
				element => !element.classList.contains(POISON_CLASS_NAME),
			)
		) {
			sections.push(building as Section);
		}
	};

	const isTitle = (element: Element) => {
		if (element.classList.contains(JOIN_CLASS_NAME)) return false;

		/* titles only contains spans, no immediate text */
		if (
			[...element.childNodes]
				.filter(node => node.nodeType === 3)
				.some(text => (text as CharacterData).data.trim() !== '')
		) {
			return false;
		}

		for (const child of element.children) {
			if (
				child.nodeType === Node.ELEMENT_NODE &&
				child.textContent!.trim() !== '' &&
				(child.nodeName === 'U' ||
					(child as HTMLElement).style.textDecoration === 'underline')
			) {
				return true;
			}
		}

		return false;
	};

	const isBreak = (element: Element) => {
		const style = (element as HTMLElement).style;
		if (style === undefined) return false;

		if (element.classList.contains(JOIN_CLASS_NAME)) return false;

		if (
			element.nodeName === 'HR' ||
			element.classList.contains(BREAK_CLASS_NAME)
		)
			return true;

		/* images are part of the section */
		if (element.getElementsByTagName('img').length > 0) {
			return false;
		}

		/* centered breaks */
		if (
			style.textAlign !== 'left' &&
			(style.textAlign === 'center' ||
				(element as HTMLParagraphElement).align === 'center')
		)
			return true;

		/* blank breaks */
		return element.textContent!.trim() === '';
	};

	const isIgnore = (element: Element) => {
		return element.nodeName === 'H3';
	};

	const newSection = (isTitle: boolean, include: Element | undefined) => {
		/* attempt to break up the section */
		saveSection(buildingSection);

		const old = buildingSection;

		/* new section carrying over data from the previous */
		buildingSection = {
			supersection: isTitle ? old.supersection + 1 : old.supersection,
			subsection: isTitle ? 0 : old.subsection + 1,
			titleElement: isTitle ? include : old.titleElement,
			bodyElements: include === undefined || isTitle ? [] : [include],
		};
	};

	let previousTitle = false;

	for (let i = 0; i < contentList.length; ++i) {
		const current = contentList[i];

		if (isIgnore(current)) continue;

		const title = isTitle(current);
		const breaking = isBreak(current);

		if ((title || breaking) && !previousTitle) {
			newSection(
				title,
				title || current.classList.contains(BREAK_CLASS_NAME)
					? current
					: undefined,
			);
		} else {
			buildingSection.bodyElements.push(current);
		}

		previousTitle = title;
	}

	/* save the last section */
	saveSection(buildingSection);

	return sections;
};

const massDownload = async (files: { filename: string; content: string }[]) => {
	const element = document.createElement('a');
	element.style.display = 'none';
	document.body.appendChild(element);

	for (const { filename, content } of files) {
		element.setAttribute(
			'href',
			'data:text/plain;charset=utf-8,' + encodeURIComponent(content),
		);
		element.setAttribute('download', filename);
		element.click();

		await new Promise(accept => setTimeout(accept, 100));
	}

	document.body.removeChild(element);
};

const sectionUniqueId = (lessonNumber: number, section: Section) =>
	`${lessonNumber}-${section.supersection}-${section.subsection}`;

const csvFilename = (lessonNumber: number) => `lesson-${lessonNumber}.csv`;

const csvBody = (lessonNumber: number, sections: Section[]) =>
	sections
		.map(
			(section, i) =>
				`${sectionUniqueId(lessonNumber, section)}, ${allElements(
					section,
				)
					.map(element => element.outerHTML)
					.join('')
					.replaceAll('\n', '')
					.replaceAll(',', '&#44;')}, ${lessonNumber}, ${i}`,
		)
		.join('\n');

const saveSections = (lessonNumber: number, sections: Section[]) =>
	massDownload([
		{
			filename: csvFilename(lessonNumber),
			content: csvBody(lessonNumber, sections),
		},
	]);

const createButton = () => {
	const button = document.createElement('button');
	button.textContent = 'Slice Lesson';

	button.style.position = 'fixed';
	button.style.right = '10px';
	button.style.bottom = '10px';
	button.style.zIndex = '999999';

	button.onclick = async () => {
		try {
			const content = grabContent();
			clearSectionClasses(content);

			await saveSections(grabLessonNumber(), globalSections);

			console.log('Saved sections!');

			findSections(content);
		} catch (err) {
			console.log(err);
		}
	};

	document.body.insertBefore(button, document.body.firstChild);
};

const createStyleSheet = (): CSSStyleSheet => {
	const head = document.head;
	const link = document.createElement('link');
	link.type = 'text/css';
	link.rel = 'stylesheet';

	head.appendChild(link);

	return document.styleSheets[document.styleSheets.length - 1];
};

const DISREGARD_CLASS_NAME = 'section-disregard';
const POISON_CLASS_NAME = 'section-poison';
const JOIN_CLASS_NAME = 'section-join';
const BREAK_CLASS_NAME = 'section-break';

const modifierClassRotation = [
	DISREGARD_CLASS_NAME,
	POISON_CLASS_NAME,
	JOIN_CLASS_NAME,
	BREAK_CLASS_NAME,
];

const colors = [
	'rgb(255 139 126)',
	'rgb(255 170 96)',
	'rgb(255 247 20)',
	'rgb(23 246 120)',
	'rgb(145 250 255)',
	'rgb(128 199 255)',
	'rgb(190 184 252)',
	'rgb(207 155 255)',
	'rgb(234 174 242)',
	'rgb(254 167 199)',
];

const generateSectionColorRules = (sheet: CSSStyleSheet) => {};

const sectionClassName = (num: number) => `htskSection-${num}`;
const isSectionClassName = (className: string) =>
	className.startsWith('htskSection-');

const findSections = (content: HTMLElement) => {
	/* find the sections */
	globalSections = parseSections(content);

	clearSectionClasses(content);

	/* color the sections */
	globalSections.forEach((section, i) => {
		const className = sectionClassName(i % colors.length);

		allElements(section).forEach(element =>
			element.classList.add(className),
		);
	});

	console.log(globalSections);
};

const clearSectionClasses = (content: HTMLElement) => {
	for (const element of content.children) {
		for (const existing of [...element.classList.values()]) {
			if (isSectionClassName(existing)) {
				element.classList.remove(existing);
			}
		}
	}
};

let globalSections: Section[];

try {
	const generalSheet = createStyleSheet();

	generalSheet.insertRule(`.entry-content > hr {
		padding-bottom: 10px;
	}`);

	generalSheet.insertRule(`.entry-content > *:hover {
		outline: 2px solid black;
	}`);

	generalSheet.insertRule(`.entry-content > .${DISREGARD_CLASS_NAME} {
		outline: 3px dotted orange;
		background-color: unset;
	}`);
	generalSheet.insertRule(`.entry-content > .${DISREGARD_CLASS_NAME}:hover {
		outline-color: orange;
	}`);

	generalSheet.insertRule(`.entry-content > .${POISON_CLASS_NAME} {
		outline: 3px dotted red;
	}`);
	generalSheet.insertRule(`.entry-content > .${POISON_CLASS_NAME}:hover {
		outline-color: red;
	}`);

	generalSheet.insertRule(`.entry-content > .${JOIN_CLASS_NAME} {
		outline: 3px dotted green;
	}`);
	generalSheet.insertRule(`.entry-content > .${JOIN_CLASS_NAME}:hover {
		outline-color: green;
	}`);

	generalSheet.insertRule(`.entry-content > .${BREAK_CLASS_NAME} {
		outline: 3px dotted blue
	}`);
	generalSheet.insertRule(`.entry-content > .${BREAK_CLASS_NAME}:hover {
		outline-color: blue;
	}`);

	for (let i = 0; i < colors.length; ++i) {
		generalSheet.insertRule(
			`.${sectionClassName(i)} { background-color: ${colors[i]} }`,
		);
	}

	const isChild = (target: EventTarget | null) => {
		if (
			target !== null &&
			(target as HTMLElement).nodeType === Node.ELEMENT_NODE
		) {
			const element = target as HTMLElement;

			if (element.parentElement === content) {
				return element;
			}
		}

		return undefined;
	};

	const content = grabContent();

	content.onclick = event => {
		const element = isChild(event.target);
		if (element === undefined) return;

		const index = modifierClassRotation.findIndex(modifier =>
			[...element.classList.values()].some(
				className => className === modifier,
			),
		);

		if (index === -1) {
			element.classList.add(modifierClassRotation[0]);
		} else {
			element.classList.remove(modifierClassRotation[index]);

			if (index < modifierClassRotation.length - 1) {
				element.classList.add(modifierClassRotation[index + 1]);
			}
		}

		findSections(content);
	};

	cleanPage(content);
	autoModifierTag(content);
	findSections(content);
	createButton();
} catch (err) {
	console.log('Not a lesson page...', err);
}
