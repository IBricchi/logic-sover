<script>
	import Search from './Search.svelte'
	let header_text = "Propositional Logic Tree Generator"
	let tree_text = ""
	let try_get_header = (query) => {
		header_text = solver.gen_interpretation(query)
	}
	let try_get_tree = (query) => {
		tree_text = solver.gen_text_tree(query)
	}
</script>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}

	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

	code {
		display: inline-block;
		white-space: pre-wrap;
		text-align: left;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>

<main>
	<h1>{header_text}</h1>
	<Search bind:check={try_get_header} bind:generate={try_get_tree}></Search>
	<code>{tree_text}</code>
</main>