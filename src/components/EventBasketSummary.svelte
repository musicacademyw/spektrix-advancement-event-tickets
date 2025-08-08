<!-- Event Basket Summary Component - displays basket contents for a specific event as Step 3 -->
<script>
    import {spektrixService} from '../services/spektrix.js';
    import {
        AlertCircle,
        Trash2,
        Utensils,
        FishOff,
        TicketCheck,
        ShoppingCart,
        Ticket,
        Info
    } from 'lucide-svelte';

    const {
        basketItems = {},
        eventId = '',
        eventTitle = '',
        basketLoading = false,
        onbasketupdated = () => {
        },
        onproceedtocheckout = () => {
        },
        ongetmariposatickets = () => {
        },
        ongetmoreadvancementtickets = () => {
        }
    } = $props();

    let loading = $state(false);
    let error = $state(null);

    // Filter tickets to only show those for this specific event
    let eventTickets = $state([]);

    $effect(() => {
        const allTickets = basketItems.tickets || [];
        eventTickets = allTickets.filter(ticket => {
            const ticketEventId = ticket.event?.id;
            return ticketEventId === eventId;
        });
    });

    const totalTickets = $derived(eventTickets.length);

    // Calculate the total cost of the event tickets
    let totalCost = $state(0);
    $effect(() => {
        totalCost = eventTickets.reduce((sum, ticket) => {
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

    // Get event information from the first ticket with proper type safety
    let eventInfo = $state({
        eventName: '',
        eventDate: '',
        eventVenue: ''
    });

    $effect(() => {
        if (eventTickets.length > 0) {
            const firstTicket = eventTickets[0];
            const rawDate = firstTicket.instance?.start;
            eventInfo = {
                eventName: firstTicket.event?.attribute_ShortEventName || 'Unknown Event',
                eventDate: rawDate || new Date().toISOString(),
                eventVenue: firstTicket.instance?.attribute_WebVenue || 'Unknown Venue'
            };
        } else {
            eventInfo = {
                eventName: '',
                eventDate: new Date().toISOString(),
                eventVenue: ''
            };
        }
    });
</script>

{#if basketLoading}
    <div class="card border border-surface-200 dark:border-surface-700 p-4">
        <div class="flex items-center justify-center space-x-3 py-4">
            <div class="animate-spin rounded-full h-5 w-5 border-2 border-primary-500 border-t-transparent"></div>
            <span class="text-surface-600 dark:text-surface-400">Loading basket...</span>
        </div>
    </div>
{:else if eventTickets.length > 0}
    <div class="space-y-4">
        <div class="flex flex-col gap-3">
            <h4 class="h5 leading-tight text-center text-lg not-lg:text-base">Review Your
                Ticket{totalTickets !== 1 ? 's' : ''} to {eventTitle}</h4>
            <div class="flex flex-wrap gap-1.5 justify-center">
                    <span class="badge preset-outlined-tertiary-100-900 text-tertiary-900-100 text-sm gap-1">
                        <TicketCheck class="w-4 h-4"/>
                        {totalTickets} ticket{totalTickets !== 1 ? 's' : ''} in basket
                    </span>
                <span class="badge preset-outlined-success-100-900 text-success-900-100 text-sm gap-1">
                        <TicketCheck class="w-4 h-4"/>
                    ${formatPrice(totalCost)} total
                    </span>
            </div>
        </div>

        <!-- Tickets content -->
        {#if error}
            <div class="card py-3 px-4 preset-filled-error-100-900 border border-error-300-700">
                <AlertCircle class="w-4 h-4"/>
                <span>{error}</span>
            </div>
        {/if}

        {#each eventTickets as ticket, index}
            <div class="card p-3 preset-filled-surface-50-950 border border-surface-100-900 border-dashed">
                <div class="flex items-end justify-between mb-3">
                    <h6 class="text-sm font-semibold flex-1 leading-tight">
                        Ticket #{index + 1}: {ticket.attribute_RegistrantName || 'Unnamed Ticket'}
                    </h6>
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
                <div class="flex flex-wrap gap-1.5">
                            <span class="badge preset-tonal-success border border-success-200-800 text-wrap text-xs gap-1 justify-start">
                                <TicketCheck class="w-3 h-3"/>
                                {ticket.planName || 'Event Ticket'} - ${formatPrice(ticket.price)}
                            </span>
                    {#if ticket.attribute_RegistrantMealChoice}
                                <span class="badge preset-tonal-secondary border border-secondary-200-800 text-wrap text-xs gap-1 justify-start">
                                    <Utensils class="w-3 h-3"/>
                                    <strong>Meal:</strong> {ticket.attribute_RegistrantMealChoice}
                                </span>
                    {/if}
                    {#if ticket.attribute_RegistrantDietaryRestrictions}
                                <span class="badge preset-tonal-error border border-error-200-800 text-wrap text-xs gap-1 justify-start">
                                    <FishOff class="w-3 h-3 min-w-3"/>
                                    <strong>Dietary:</strong> {ticket.attribute_RegistrantDietaryRestrictions}
                                </span>
                    {/if}
                </div>
            </div>
        {/each}

        <!-- Footer with checkout button -->
        <footer class="flex flex-col gap-3">
            <button
                    class="btn w-full preset-filled-primary-700-300"
                    onclick={() => onproceedtocheckout()}
                    type="button"
            >
                <ShoppingCart class="w-5 h-5"/>
                <span>Proceed to Checkout</span>
            </button>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <button
                        class="btn w-full preset-outlined-secondary-700-300 text-secondary-700-300"
                        onclick={() => ongetmariposatickets()}
                        type="button"
                >
                    <Ticket class="w-5 h-5"/>
                    <span>Get Mariposa Tickets</span>
                </button>
                <button
                        class="btn w-full preset-outlined-tertiary-700-300 text-tertiary-700-300"
                        onclick={() => ongetmoreadvancementtickets()}
                        type="button"
                >
                    <Info class="w-5 h-5"/>
                    <span>Browse Other Advancement Events</span>
                </button>
            </div>
        </footer>
    </div>
{/if}
