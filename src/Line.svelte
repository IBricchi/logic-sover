<script>
    // export let width;
    export let line;

    // let line_size_char;
    // $: line_size_char = (
    //     line
    //         ? line.type == "p"
    //             ? `${line.ln} P ${line.formula}`
    //             : line.type == "ne"
    //             ? `${line.ln} DNE(${line.src}) ${line.formula}`
    //             : line.type == "a"
    //             ? `${line.ln} a(${line.src}) ${line.formula}`
    //             : line.type == "b"
    //             ? `${line.ln} b{${line.src},${line.min_src}} ${line.formula}`
    //             : line.type == "e"
    //             ? `${line.ln} e{${line.src},${line.min_src}} ${line.formula}`
    //             : line.type == "o"
    //             ? `${line.ln} O`
    //             : line.type == "c"
    //             ? `${line.ln} X(${line.src},${line.min_src}) ${line.formula}`
    //             : line.type == "br"
    //             ? `${line.ln} B ${line.formula}`
    //             : ""
    //         : ""
    // ).length;
    // let line_size;
    // $: line_size = line_size_char * 8.5;
</script>

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
    <span class="reason reason-full">OPEN</span>
{:else if line.type == "c"}
    <span class="ln">{line.ln}</span>
    <span class="reason">X({line.src},{line.min_src})</span>
{:else if line.type == "br"}
    <span class="ln">{line.ln}</span>
    <span class="reason">B</span>
    <span class="formula">{line.formula}</span>
{/if}

<style>
    .ln {
        grid-column: 1;
    }
    .reason {
        padding-left: 10px;
        grid-column: 2;
    }

    .reason-full {
        grid-column-start: 2;
        grid-column-end: 4;
    }
    .formula {
        grid-column: 3;
        justify-self: center;
    }
</style>
