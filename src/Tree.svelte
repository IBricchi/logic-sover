<script>
    import Line from "./Line.svelte";
    import Connect from "./Connect.svelte";

    // inputs
    export let lines;

    // outputs
    export let highlights;
    export let box;

    let has_branch;
    $: has_branch = lines.length != 0 ? lines.at(-1).type == "bc" : false;

    let left = false;
    let right = false;
</script>

<div class="section-container">
    <div class="section-grid" bind:this={box}>
        {#each lines as line}
            {#if line.type != "bc"}
                <Line {line} />
            {/if}
        {/each}
    </div>
</div>

{#if has_branch}
    <Connect start={box} end={left} />
    <Connect start={box} end={right} />
    <div class="split-container">
        <div class="split split-left">
            <svelte:self
                lines={lines.at(-1).left}
                bind:highlights
                bind:box={left}
            />
        </div>
        <div class="split split-right">
            <svelte:self
                lines={lines.at(-1).right}
                bind:highlights
                bind:box={right}
            />
        </div>
    </div>
{/if}

<style>
    .section-container {
        width: auto;
        margin: auto;
    }
    .section-grid {
        padding-bottom: 10px;
        display: inline-grid;
        grid-template-columns: auto auto auto;
        grid-gap: 10px;
        justify-items: left;
        margin-bottom: 20px;
    }

    .split-container {
        display: flex;
        flex-direction: row;
        flex: 1;
    }
    .split {
        flex-grow: 1;
        /* border-style: dotted; */
    }
</style>
