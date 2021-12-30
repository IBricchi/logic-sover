<script>
import { missing_component } from "svelte/internal";


    export let start;
    export let end;

    let update = 1;

    let x = 0,
        y = 0,
        x1 = 0,
        y1 = 0,
        x2 = 0,
        y2 = 0,
        width = 0,
        height = 0;

    $: if (start && end && update) {
        let sbb = start.getBoundingClientRect();
        let ebb = end.getBoundingClientRect();

        x1 = sbb.x + sbb.width / 2 + window.scrollX;
        y1 = sbb.bottom + window.scrollY;
        x2 = ebb.x + ebb.width / 2 + window.scrollX;
        y2 = ebb.top + window.scrollY;
        
        x = Math.min(x1, x2);
        y = Math.min(y1, y2);
        
        x1 -= x;
        y1 -= y;
        x2 -= x;
        y2 -= y;

        width = Math.abs(x2 - x1);
        height = Math.abs(y2 - y1);
    }

    var svg;
</script>

<svelte:window on:resize="{() => update+=1}"/>

<svg bind:this={svg} style="top:{y}px;left:{x}px;width:{width}px;height:{height}px;">
    <line x1={x1} x2={x2} y1={y1} y2={y2} />
</svg>

<style>
    svg {
        position: absolute;
    }
    line {
        stroke: black;
        stroke-width: 2;
    }
</style>
