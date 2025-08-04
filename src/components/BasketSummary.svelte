<!-- Basket Summary Component - displays basket contents using Custom Baskets API -->
<script>
    import {spektrixService} from '../services/spektrix.js';
    import {
        AlertCircle,
        ShoppingCart,
        Trash2,
        User,
        Utensils,
        FishOff,
        CalendarClock,
        MapPin,
        TicketCheck, Ticket
    } from 'lucide-svelte';

    const {
        basketItems = {},
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
            const eventName = ticket.event?.attribute_ShortEventName || 'Unknown Event';
            const eventDate = ticket.instance?.start || 'Unknown Date';
            const eventVenue = ticket.instance?.attribute_WebVenue || 'Unknown Venue';
            if (!eventId) {
                console.warn('Ticket missing event id:', ticket);
            }
            if (!groups[eventId]) {
                groups[eventId] = {
                    eventName,
                    eventDate,
                    eventVenue,
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
    <div class="flex flex-col sticky top-3" style="height: calc(100vh - 3rem);">
        <div class="card border-2 border-surface-200 dark:border-surface-700 overflow-hidden flex flex-col h-full">
            <header class="preset-filled-surface-50-950 px-5 py-3 border-b border-surface-200-800 flex-shrink-0">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-primary-500 rounded-lg">
                            <Ticket class="w-5 h-5 text-white"/>
                        </div>
                        <div>
                            <h3 class="h4 text-lg leading-tight font-semibold">Ticket Summary</h3>
                        </div>
                    </div>
                </div>
            </header>

            <!-- Tickets content - scrollable section -->
            <div class="p-4 space-y-6 overflow-y-auto flex-1 min-h-0">
                {#if error}
                    <div class="card py-3 px-4 preset-filled-error-100-900 border border-error-300-700">
                        <AlertCircle class="w-4 h-4"/>
                        <span>{error}</span>
                    </div>
                {/if}

                <!-- Group tickets by event -->
                {#each Object.entries(groupedTickets) as [eventId, group]}
                    <div class="card p-4 border border-dashed border-surface-300-700">
                        <!-- Event header -->
                        <div class="flex flex-col gap-1 mb-3">
                            <h4 class="text-sm font-semibold text-center">{group.eventName}</h4>
                            <!-- Event information -->
                            <span class="badge preset-outlined-primary-100-900 text-primary-900-100 text-[0.9rem] leading-[1.2] gap-1">
                                <CalendarClock class="w-2.5 h-2.5"/>
                                <time datetime={new Date(group.eventDate).toISOString()}>
                                {new Date(group.eventDate).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric'
                                })} at {new Date(group.eventDate).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit'
                                })}
                            </time>
                            </span>
                            <span class="badge preset-outlined-secondary-100-900 text-secondary-900-100 text-[0.9rem] leading-[1.2] gap-1">
                                    <MapPin class="w-2.5 h-2.5"/>{group.eventVenue}
                                </span>
                            <span class="badge preset-outlined-tertiary-100-900 text-tertiary-900-100 text-[0.9rem] leading-[1.2] gap-1">
                                    <TicketCheck class="w-3 h-3"/>
                                {group.tickets.length} ticket{group.tickets.length !== 1 ? 's' : ''}
                                (${group.tickets.reduce((sum, ticket) => {
                                const ticketPrice = ticket.total || ticket.price || 0;
                                return sum + ticketPrice;
                            }, 0)})
                            </span>
                        </div>

                        <!-- Event tickets -->
                        <div class="space-y-3">
                            {#each group.tickets as ticket}
                                <div class="card p-3.5 preset-filled-surface-50-950 border border-surface-100-900 border-dashed">
                                    <div class="flex items-end justify-between mb-3">
                                        <h5 class="text-base font-semibold flex-1 leading-tight">
                                            {ticket.attribute_RegistrantName || 'Unnamed Ticket'}
                                        </h5>
                                        <button
                                                class="btn-icon btn-icon-sm p-1 border-1 border-transparent text-error-700-300 hover:preset-outlined-error-700-300"
                                                onclick={() => removeTickets([ticket.id])}
                                                disabled={loading}
                                                type="button"
                                                title="Remove ticket"
                                        >
                                            {#if loading}
                                                <div class="animate-spin rounded-full h-3 w-3 border border-surface-800-200 border-t-transparent"></div>
                                            {:else}
                                                <Trash2 class="w-3 h-3"/>
                                            {/if}
                                        </button>
                                    </div>
                                    <!-- Ticket details -->
                                    <div class="flex flex-col flex-wrap gap-1.5">
                                        <span class="badge preset-tonal-success border border-success-200-800 text-wrap text-[0.9rem] leading-[1.2] gap-1 justify-start"><TicketCheck
                                                class="w-4 h-4"/>{ticket.planName || 'Event Ticket'}
                                            - ${formatPrice(ticket.price)}</span>
                                        {#if ticket.attribute_RegistrantMealChoice}
                                                    <span class="badge preset-tonal-secondary border border-secondary-200-800 text-wrap text-[0.9rem] leading-[1.2] gap-1 justify-start">
                                                        <Utensils class="w-3 h-3"/>
                                                        <strong>Meal Choice:</strong> {ticket.attribute_RegistrantMealChoice}
                                                    </span>
                                        {/if}
                                        {#if ticket.attribute_RegistrantDietaryRestrictions}
                                                    <span class="badge preset-tonal-error border border-error-200-800 text-wrap text-[0.9rem] leading-[1.2] gap-1 justify-start">
                                                        <FishOff class="w-4 h-4 min-w-4"/>
                                                        <p><strong>Dietary Restrictions:</strong> {ticket.attribute_RegistrantDietaryRestrictions}</p>
                                                    </span>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>

            <!-- Footer with checkout button -->
            <footer class="preset-filled-surface-50-950 px-5 py-3 border-t border-surface-200-800 flex-shrink-0">
                <button
                        class="btn w-full preset-filled-primary-700-300"
                        onclick={() => onproceedtocheckout()}
                        type="button"
                >
                    <ShoppingCart class="w-4 h-4"/>
                    <span>Proceed to Checkout</span>
                </button>
            </footer>
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
