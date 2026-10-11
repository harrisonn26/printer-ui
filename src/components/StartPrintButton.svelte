<script lang="ts">
    import { mdiPlay } from "@mdi/js";
    import { session } from "../lib/moonraker/session.svelte";
    import { job } from "../lib/moonraker/job.svelte";
    import { router } from "../lib/router.svelte";
    import { jobTitle } from "../lib/format";
    import ConfirmButton from "../lib/ui/ConfirmButton.svelte";

    let { filename, label = "Print" }: { filename: string; label?: string } =
        $props();

    // Starting heats the printer and feeds filament, so it asks before it runs.
    const start = async () => {
        const started = await session.run("printer.print.start", { filename });
        if (started !== undefined) router.go("/");
    };
</script>

<ConfirmButton
    {label}
    confirmTitle="Start this print?"
    confirmLabel="Start print"
    message={jobTitle(filename)}
    variant="secondary"
    size="sm"
    icon={mdiPlay}
    disabled={!session.klippyReady || job.active}
    title={job.active ? "A print is already running" : undefined}
    onconfirm={start}
/>
