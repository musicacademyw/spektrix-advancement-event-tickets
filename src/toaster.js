import {createToaster} from '@skeletonlabs/skeleton-svelte';

export const toaster = createToaster({
    placement: 'top-end',
    max: 10,
    duration: 10000, // 10 seconds
    closable: true
});
