<script>
    let query
    export let check;
    export let generate;
    let gen = () => {
        check(query)
        generate(query)
    }
</script>

<style>
    .container{
        width: 100%;
        grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
    }
    input, button{
        height: 40px;
        font-size: 30px;
        line-height: 0px;
        vertical-align: middle;
    }
    input{
        grid-column-start: 1;
        grid-column-end: 4;
    }
    button{
        grid-column-start: 4;
        grid-column-end: 5
    }
</style>

<div class="container">
    <input type="text" on:keypress="{(e)=>{if(e.key=='Enter'){gen()}}}" bind:value={query}>
    <button on:click={gen}>
        Gen
    </button>
</div>