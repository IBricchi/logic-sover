<script>
    import Line from "./Line.svelte";

    // inputs
    export let lines;

    // outputs
    export let highlights;

    let has_branch;
    $: has_branch = lines.length != 0 ? lines.at(-1).type == "bc" : false;

    let section;
    $: if (section && lines.length != 0) {
        let lines = section.querySelectorAll(".line");
        let min_widths = Array.from(lines).map((line) => {
            let m = line.style.minWidth;
            return m.substring(0, m.length - 2);
        });
        let min_width = Math.max(...min_widths);
        console.log(min_width, min_widths)
        // let min_width = min_widths.reduce((a, b) => (a < b) ? a : b, 0);
        lines.forEach((line) => {
            line.style.width = `${min_width}pt`;
            console.log(min_width)
        });
    }
</script>

<div class="section-container" bind:this={section}>
    {#each lines as line}
        {#if line.type != "bc"}
            <Line {line} />
        {/if}
    {/each}
</div>

{#if has_branch}
    <div class="split-container">
        <div class="split split-left">
            <svelte:self lines={lines.at(-1).left} bind:highlights />
        </div>
        <div class="split split-right">
            <svelte:self lines={lines.at(-1).right} bind:highlights />
        </div>
    </div>
{/if}

<style>
    .section-container {
        display: grid;
        grid-template-columns: auto;
        grid-template-rows: repeat(auto-fill, auto);
    }
    .split-container {
        display: flex;
        flex-direction: row;
        flex: 1;
    }
    .split {
        flex-grow: 1;
        border-style: dotted;
    }
</style>
