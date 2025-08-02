import {createToaster} from '@skeletonlabs/skeleton-svelte';

// TODO: Style the toasts and make sure line height is good
export const toaster = createToaster({
    placement: 'top-end',
    max: 10,
    duration: 10000, // 10 seconds
    closable: true
});
