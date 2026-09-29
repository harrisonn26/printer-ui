<script lang="ts">
  import { mdiPlay } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import { router } from '../lib/router.svelte'
  import Button from '../lib/ui/Button.svelte'

  let { filename, label = 'Print' }: { filename: string, label?: string } = $props()

  const CONFIRM_MS = 4000

  let confirming = $state(false)
  let loading = $state(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  $effect(() => () => clearTimeout(timer))

  // Starting heats the printer and moves it: ask once more.
  const click = async () => {
    if (!confirming) {
      confirming = true
      timer = setTimeout(() => { confirming = false }, CONFIRM_MS)
      return
    }
    clearTimeout(timer)
    confirming = false
    loading = true
    const started = await session.run('printer.print.start', { filename })
    loading = false
    if (started !== undefined) router.go('/')
  }
</script>

<Button
  variant={confirming ? 'primary' : 'secondary'}
  size="sm"
  icon={confirming ? undefined : mdiPlay}
  {loading}
  disabled={!session.klippyReady || job.active}
  title={job.active ? 'A print is already running' : undefined}
  onclick={click}
>{confirming ? 'Start print?' : label}</Button>
