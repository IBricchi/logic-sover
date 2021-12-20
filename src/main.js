import App from './App.svelte';

const app = new App({
	target: document.body,
	props: {
		tree: [
			{type: "p", ln: 0, formula: "a|b&c→d↔e"},
			{type: "p", ln: 1, formula: "f↔g→h&i|j"},
			{type: "bc", 
				left: [
					{type: "b", ln: 2, formula: "f↔g→h&i"},
					{type: "bc", 
						left: [
							{type: "b", ln: 3, formula: "a"},
							{type: "o", ln: 4}
						],
						right: [
							{type: "b", ln: 3, formula: "¬a"},
							{type: "b", ln: 4, src: 0, min_src: 3, formula: "b&c→d↔e"},
							{type: "a", ln: 5, src: 4, formula: "b"},
							{type: "a", ln: 6, src: 4, formula: "c→d↔e"},
							{type: "bc", 
								left: [
									{type: "b", ln: 7, formula: "c"},
									{type: "b", ln: 8, src: 6, min_src: 7, formula: "d↔e"},
									{type: "bc", 
										left: [
											{type: "b", ln: 9, formula: "d"},
											{type: "e", ln: 10, src: 8, min_src: 9, formula: "e"},
											{type: "o", ln: 11}],
												right: [
													{type: "b", ln: 9, formula: "¬d"},
													{type: "e", ln: 10, src: 8, min_src: 9, formula: "¬e"},
													{type: "o", ln: 11}
												]}
											],
											right: [
												{type: "b", ln: 7, formula: "¬c"},
												{type: "o", ln: 8}
											]}
										]}
									],
									right: [
										{type: "b", ln: 2, formula: "¬(f↔g→h&i)"},
										{type: "b", ln: 3, src: 1, min_src: 2, formula: "j"},
										{type: "bc",
											left: [
												{type: "b", ln: 4, formula: "a"},
												{type: "o", ln: 5}
											],
											right: [
												{type: "b", ln: 4, formula: "¬a"},
												{type: "b", ln: 5, src: 0, min_src: 4, formula: "b&c→d↔e"},
												{type: "a", ln: 6, src: 5, formula: "b"},
												{type: "a", ln: 7, src: 5, formula: "c→d↔e"},
												{type: "bc", 
													left: [
														{type: "b", ln: 8, formula: "c"},
														{type: "b", ln: 9, src: 7, min_src: 8, formula: "d↔e"},
														{type: "bc",
															left: [
																{type: "b", ln: 10, formula: "d"},
																{type: "e", ln: 11, src: 9, min_src: 10, formula: "e"},
																{type: "o", ln: 12}
															],
															right: [
																{type: "b", ln: 10, formula: "¬d"},
																{type: "e", ln: 11, src: 9, min_src: 10, formula: "¬e"},
																{type: "o", ln: 12}
															]}
														],
														right: [
															{type: "b", ln: 8, formula: "¬c"},
															{type: "o", ln: 9}
														]}
													]}
												]}
											]
	}
});

export default app;