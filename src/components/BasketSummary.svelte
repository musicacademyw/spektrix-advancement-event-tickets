<!-- Basket Summary Component - displays basket contents using Custom Baskets API -->
<script>
    import {spektrixService} from '../services/spektrix.js';
    import {AlertCircle, ShoppingCart, Trash2, User, Utensils, FishOff} from 'lucide-svelte';

    const {
        basketItems = {},
        attendees = [],
        advancementEventIds = [],
        basketLoading = false,
        onbasketupdated = () => {
        },
        onproceedtocheckout = () => {
        }
    } = $props();

    let loading = $state(false);
    let error = $state(null);

    // Simple reactive variable instead of derived
    let filteredTickets = $state([]);

    // Filter to the tickets only for the advancement events
    $effect(() => {
        const allTickets = basketItems.tickets || [];

        if (advancementEventIds.length === 0) {
            filteredTickets = allTickets;
            return;
        }

        filteredTickets = allTickets.filter(ticket => {
            const eventId = ticket.event?.id;
            return advancementEventIds.includes(eventId);
        });
    });

    const totalTickets = $derived(filteredTickets.length);

    // Calculate the total cost of the filtered tickets
    let totalCost = $state(0);
    $effect(() => {
        totalCost = filteredTickets.reduce((sum, ticket) => {
            const ticketPrice = ticket.total || ticket.price || 0;
            return sum + ticketPrice;
        }, 0);
    });

    function formatPrice(price) {
        return (Number(price) || 0).toFixed(0);
    }

    async function removeTickets(ticketIds) {
        loading = true;
        try {
            await spektrixService.removeTickets(ticketIds);
            onbasketupdated();
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    }

    // Group tickets by event for better organization
    let groupedTickets = $state({});
    $effect(() => {
        const groups = {};
        filteredTickets.forEach(ticket => {
            const eventId = ticket.event?.id;
            const eventName = ticket.event?.name || 'Unknown Event';
            if (!eventId) {
                console.warn('Ticket missing event id:', ticket);
            }
            if (!groups[eventId]) {
                groups[eventId] = {
                    eventName,
                    tickets: []
                };
            }
            groups[eventId].tickets.push(ticket);
        });
        groupedTickets = groups;
    });
</script>

{#if basketLoading}
    <div class="card border-2 border-surface-200 dark:border-surface-700 p-6">
        <div class="flex items-center justify-center space-x-3 py-8">
            <div class="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent"></div>
            <span class="text-surface-600 dark:text-surface-400">Loading basket...</span>
        </div>
    </div>
{:else if filteredTickets.length > 0}
    <div class="card border-2 border-surface-200 dark:border-surface-700 overflow-hidden">
        <!-- Header with gradient background -->
        <header class="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 px-6 py-4 border-b border-surface-200 dark:border-surface-700">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-primary-500 rounded-lg">
                        <ShoppingCart class="w-5 h-5 text-white"/>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100">Your Basket</h3>
                        <p class="text-sm text-surface-600 dark:text-surface-400">
                            {totalTickets} ticket{totalTickets !== 1 ? 's' : ''} selected
                        </p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
                        ${formatPrice(totalCost)}
                    </div>
                    <div class="text-xs text-surface-500 uppercase tracking-wide">
                        Total
                    </div>
                </div>
            </div>
        </header>

        <!-- Tickets content -->
        <div class="p-6 space-y-6">
            {#if error}
                <div class="card py-3 px-4 preset-filled-error-100-900 border border-error-300-700">
                    <AlertCircle class="w-4 h-4"/>
                    <span>{error}</span>
                </div>
            {/if}

            <!-- Group tickets by event -->
            {#each Object.entries(groupedTickets) as [eventId, group]}
                <div class="space-y-3">
                    <!-- Event header -->
                    <div class="flex items-center gap-2 pb-2 border-b border-surface-200 dark:border-surface-600">
                        <span class="badge preset-filled-primary-500 text-xs font-medium">
                            {group.eventName}
                        </span>
                        <span class="text-xs text-surface-500">
                            {group.tickets.length} ticket{group.tickets.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    <!-- Event tickets -->
                    <div class="space-y-3">
                        {#each group.tickets as ticket}
                            <div class="bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-600 rounded-lg p-4 transition-all duration-200 hover:shadow-md">
                                <!-- Ticket header -->
                                <div class="flex items-start justify-between mb-3">
                                    <div class="flex-1">
                                        <h5 class="font-semibold text-surface-900 dark:text-surface-100 mb-1">
                                            {ticket.planName || 'Event Ticket'}
                                        </h5>
                                        <div class="flex items-center gap-4 text-sm text-surface-600 dark:text-surface-400">
                                            <span class="font-medium">${formatPrice(ticket.price)}</span>
                                            {#if ticket.attribute_RegistrantName}
                                                <span class="flex items-center gap-1">
                                                    <User class="w-3 h-3"/>
                                                    {ticket.attribute_RegistrantName}
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                    <button
                                            class="btn-icon preset-filled-error-200-800"
                                            onclick={() => removeTickets([ticket.id])}
                                            disabled={loading}
                                            type="button"
                                            title="Remove ticket"
                                    >
                                        {#if loading}
                                            <div class="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>
                                        {:else}
                                            <Trash2 class="w-3 h-3"/>
                                        {/if}
                                    </button>
                                </div>

                                <!-- Attendee details -->
                                <div class="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-600 rounded-md p-3">
                                    {#if ticket.attribute_RegistrantName}
                                        <div class="space-y-2 text-sm">
                                            <span class="badge preset-tonal-primary leading-[1.2]">
                                                <User class="w-4 h-4"/>
                                                {ticket.attribute_RegistrantName}
                                            </span>
                                            {#if ticket.attribute_RegistrantMealChoice}
                                                <span class="badge preset-tonal-secondary leading-[1.2]">
                                                    <Utensils class="w-4 h-4"/>
                                                    {ticket.attribute_RegistrantMealChoice}
                                                </span>
                                            {/if}
                                            {#if ticket.attribute_RegistrantDietaryRestrictions}
                                                <span class="badge preset-tonal-error text-wrap leading-[1.2]">
                                                    <FishOff class="w-4 h-4 min-w-4"/>
                                                    <p><strong>Dietary Restrictions:</strong> {ticket.attribute_RegistrantDietaryRestrictions}</p>
                                                </span>
                                            {/if}
                                        </div>
                                    {:else}
                                        <div class="flex items-center gap-2 text-warning-600 dark:text-warning-400">
                                            <AlertCircle class="w-4 h-4"/>
                                            <span class="text-sm font-medium">Attendee information needed</span>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>

        <!-- Footer with checkout button -->
        <footer class="bg-surface-50 dark:bg-surface-800 px-6 py-4 border-t border-surface-200 dark:border-surface-700">
            <div class="flex items-center justify-between mb-3">
                <div class="text-sm text-surface-600 dark:text-surface-400">
                    Ready to complete your purchase?
                </div>
                <div class="text-right">
                    <div class="text-lg font-bold text-surface-900 dark:text-surface-100">
                        Total: ${formatPrice(totalCost)}
                    </div>
                </div>
            </div>
            <button
                    class="btn preset-filled-primary-300-700 w-full"
                    onclick={() => onproceedtocheckout()}
                    type="button"
            >
                <ShoppingCart class="w-4 h-4"/>
                <span>Proceed to Checkout</span>
            </button>
        </footer>
    </div>
{:else if basketItems.tickets && basketItems.tickets.length > 0}
    <!-- Debug state when tickets exist but none match filter -->
    <div class="card border-2 border-warning-200 dark:border-warning-700 p-6">
        <div class="text-center space-y-4">
            <div class="p-3 bg-warning-100 dark:bg-warning-900/20 rounded-lg inline-block">
                <AlertCircle class="w-6 h-6 text-warning-600"/>
            </div>
            <div>
                <h3 class="h4 font-semibold text-warning-800 dark:text-warning-200 mb-2">
                    No Matching Tickets
                </h3>
                <p class="text-sm text-surface-600 dark:text-surface-400 mb-4">
                    You have tickets in your basket, but none match the advancement events.
                </p>
                <div class="bg-surface-100 dark:bg-surface-800 rounded-lg p-3 text-xs text-left space-y-1">
                    <div><strong>Raw tickets:</strong> {basketItems.tickets?.length || 0}</div>
                    <div><strong>Filtered tickets:</strong> {filteredTickets.length}</div>
                    <div><strong>Target events:</strong> {advancementEventIds.length}</div>
                </div>
            </div>
        </div>
    </div>
{:else}
    <!-- Empty basket state -->
    <div class="card border-2 border-surface-200 dark:border-surface-700 p-8">
        <div class="text-center space-y-4">
            <div class="p-4 bg-surface-100 dark:bg-surface-800 rounded-full inline-block">
                <ShoppingCart class="w-8 h-8 text-surface-400"/>
            </div>
            <div>
                <h3 class="h4 font-semibold text-surface-900 dark:text-surface-100 mb-2">
                    Your Basket is Empty
                </h3>
                <p class="text-surface-600 dark:text-surface-400">
                    Select tickets from the events above to get started.
                </p>
            </div>
        </div>
    </div>
{/if}
