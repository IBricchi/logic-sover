<script>
    // inputs
    export let lines;
    export let depth;
    export let width;

    // outputs
    export let max_line_size;
    export let highlights;
    export let max_depth;

    // internal
    let line, child_lines, line_number;
    $: line = lines ? lines[0] : undefined;
    $: child_lines = lines ? lines.splice(1) : [];
    $: line_number = line ? line.ln : 0;

    let line_size_char, line_size;
    $: line_size_char = (
        line
            ? line.type == "p"
                ? `${line.ln} P ${line.formula}`
                : line.type == "ne"
                ? `${line.ln} DNE(${line.src}) ${line.formula}`
                : line.type == "a"
                ? `${line.ln} a(${line.src}) ${line.formula}`
                : line.type == "b"
                ? `${line.ln} b{${line.src},${line.min_src}} ${line.formula}`
                : line.type == "e"
                ? `${line.ln} e{${line.src},${line.min_src}} ${line.formula}`
                : line.type == "o"
                ? `${line.ln} OPEN`
                : line.type == "c"
                ? `${line.ln} X(${line.src},${line.min_src}) ${line.formula}`
                : line.type == "br"
                ? `${line.ln} B ${line.formula}`
                : ""
            : ""
    ).length;
    $: line_size = line_size_char * 8.5;

    let child_max_line_size = 0;
    $: max_line_size =
        line_size > child_max_line_size ? line_size : child_max_line_size;
    $: width = max_line_size > width ? max_line_size : width;
    $: console.log(max_line_size, width);

    let child_max_depth = 0;
    $: max_depth =
        depth > child_max_depth ? depth : child_max_depth;
</script>

{#if child_lines && child_lines.length != 0}
    <div style="width:{width}pt" class="line">
        {#if line}
            {#if line.type == "p"}
                <span class="ln">{line.ln}</span>
                <span class="reason">P</span>
                <span class="formula">{line.formula}</span>
            {:else if line.type == "ne"}
                <span class="ln">{line.ln}</span>
                <span class="reason">DNE({line.src})</span>
                <span class="formula">{line.formula}</span>
            {:else if line.type == "a"}
                <span class="ln">{line.ln}</span>
                <span class="reason">α({line.src})</span>
                <span class="formula">{line.formula}</span>
            {:else if line.type == "b"}
                <span class="ln">{line.ln}</span>
                <span class="reason">β({(line.src, line.min_src)})</span>
                <span class="formula">{line.formula}</span>
            {:else if line.type == "e"}
                <span class="ln">{line.ln}</span>
                <span class="reason">η({(line.src, line.min_src)})</span>
                <span class="formula">{line.formula}</span>
            {:else if line.type == "o"}
                <span class="ln">{line.ln}</span>
                <span class="reason">OPEN</span>
            {:else if line.type == "c"}
                <span class="ln">{line.ln}</span>
                <span class="reason">X({line.src},{line.min_src})</span>
            {:else if line.type == "br"}
                <span class="ln">{line.ln}</span>
                <span class="reason">B</span>
                <span class="formula">{line.formula}</span>
            {/if}
        {/if}
    </div>

    <svelte:self
        lines={child_lines}
        {depth}
        {width}
        bind:max_line_size={child_max_line_size}
        bind:max_depth={child_max_depth}
        bind:highlights
    />
{:else if line && line.type == "bc"}
    <div class="split-container">
        <!-- <img style="width:{width*2/3}pt" class="line-left" src="img/line.png" alt="conecting line">
        <img style="width:{width*2/3}pt" class="line-right" src="img/line.png" alt="connecting line"> -->
        <div class="split split-left">
            <svelte:self
                lines={line.left}
                depth={depth+1}
                {width}
                bind:max_line_size={child_max_line_size}
                bind:max_depth={child_max_depth}
                bind:highlights
            />
        </div>
        <div class="split split-right">
            <svelte:self
                lines={line.right}
                depth={depth+1}
                {width}
                bind:max_line_size={child_max_line_size}
                bind:max_depth={child_max_depth}
                bind:highlights
            />
        </div>
    </div>
{/if}

<style>
    .split-container{
        /* min-width: 100%; */
        /* display: grid;
        grid-template-columns: 1fr 1fr;
        align-items: top; */
        display: flex;
        flex-direction: row;
        flex: 1;
        /* grid-template-rows: auto auto; */
    }
    /* .line-left{
        height: 1em;
        grid-column: 1;
        grid-row: 1;
        justify-self: right;
    }
    .line-right{
        transform: scaleX(-1);
        height: 1em;
        grid-column: 2;
        grid-row: 1;
        justify-self: left;
    } */
    /* .split-left{
        grid-row: 2;
        grid-column: 1;
    }
    .split-right{
        grid-row: 2;
        grid-column: 2;
    } */
    .split{
        /* float: left; */
        /* margin: auto; */
        flex-grow: 1;
        border-style: dotted;
    }
    .line{
        text-align: left;
        margin: auto;
        display: grid;
        grid-template-columns: 10% 15% auto;
    }
    .line .ln{
        grid-column: 1;
        /* background-color: red; */
        /* text-align: centre; */
    }
    .line .reason{
        grid-column: 2;
        /* background-color: green; */
        /* text-align: centre; */
    }
    .line .formula{
        grid-column: 3;
        /* background-color: blue; */
        justify-self: center;
    }

</style>
