const random = (min: number, max: number) =>
	Math.floor(Math.random() * (max - min)) + min;

const classes = ['hangul0', 'hangul1', 'hangul2'];

const exists = (element: HTMLElement) => {
	for (const sub of element.children) {
		if (sub.nodeName === 'B') return true;
	}

	return false;
};

const decorate = (element: HTMLElement) => {
	const width = element.clientWidth;
	const height = element.clientHeight;

	const charArea = 140;

	const deviationX = 35;
	const deviationY = 70;

	const charsWide = width / charArea;
	const charsTall = height / charArea;

	for (let j = 0; j < charsTall; ++j) {
		const offsetX = j % 2 == 0 ? charArea * 0.25 : charArea * 0.75;
		const onRow = j % 2 == 0 ? charsWide : charsWide - 1;

		for (let i = 0; i < onRow; ++i) {
			const b = document.createElement('b');
			b.textContent = String.fromCharCode(random(0xac00, 0xd7a4));

			b.style.left = `${
				((i * charArea +
					offsetX +
					random(-deviationX, deviationX) -
					15) /
					width) *
				100
			}%`;
			b.style.top = `${
				((j * charArea + random(-deviationY, deviationY)) / height) *
				100
			}%`;

			b.className = classes[random(0, classes.length)];

			element.appendChild(b);
		}
	}
};

console.log('Decorating!!!');

if (!exists(document.body)) decorate(document.body);
