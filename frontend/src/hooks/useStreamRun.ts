import { useEffect, useState } from 'react'
import { createRunController, type RunController } from '@/utils/runController'

/** A run controller tied to the component's lifetime; unmounting stops the run silently. */
export function useStreamRun(): RunController {
    const [controller] = useState(createRunController)
    useEffect(() => () => controller.dispose(), [controller])
    return controller
}
