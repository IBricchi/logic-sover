<script>
	import Search from "./Search.svelte";
	import Tree from "./Tree.svelte";

	let header_text = "Propositional Logic Tree Generator";
	let try_get_header = (query) => {
		header_text = solver.gen_interpretation(query);
	};
	let tree_text = "";
	let use_text = false;
	let try_gen_tree_text = (query) => {
		tree_text = solver.gen_text_tree(query);
	};
	let tree = [];
	let try_gen_tree = (query) => {
		tree = JSON.parse(solver.gen_tree(query));
	};
	let cont_width,
		width = 0,
		max_depth;
	$: cont_width = width * (2 ^ (max_depth));
</script>

<main>
	<h1>{header_text}</h1>
	<Search bind:check={try_get_header} bind:generate={try_gen_tree} />
	{#if use_text}
		<code>{tree_text}</code>
	{:else if tree != []}
		<div class="tree-cont" style="width:{cont_width}pt">
		<!-- <div class="tree-cont"> -->
			<Tree
				highlights={[]}
				lines={tree}
				depth={0}
				bind:width
				bind:max_depth
			/>
		</div>
	{/if}
</main>

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

	.tree-cont {
		text-align: center;
		min-width: 100%;
	}
</style>
