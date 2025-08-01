<!-- Event Card Component - displays event details and ticket selection -->
<script>
    import {TriangleAlert, TicketX, TicketCheck, CalendarClock, MapPin} from 'lucide-svelte';

    const {
        event,
        availability,
        selectedTickets = [],
        onticketselection = () => {
        }
    } = $props();

    let error = $state(null);

    // Extract data from availability structure using $derived
    const instance = $derived(availability?.instance);
    const status = $derived(availability?.status);
    const priceList = $derived(availability?.priceList);
    const plan = $derived(availability?.plan);

    // Check if event is on sale and available using $derived
    const isOnSale = $derived(instance &&
        new Date() >= new Date(instance.startSellingAtWeb) &&
        new Date() <= new Date(instance.stopSellingAtWeb));
    const hasAvailability = $derived(status && (status.available > 0 || (status.areas && status.areas.some(area => area.available > 0))));

    // Get sale status message with formatted dates
    const saleStatusMessage = $derived.by(() => {
        if (!instance) return '';

        const now = new Date();
        const startSelling = new Date(instance.startSellingAtWeb);
        const stopSelling = new Date(instance.stopSellingAtWeb);

        const formatDate = (date) => {
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) + ' at ' + date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short'
            });
        };

        if (now < startSelling) {
            return `Tickets go on sale ${formatDate(startSelling)}`;
        } else if (now > stopSelling) {
            return `Ticket sales ended ${formatDate(stopSelling)}`;
        }
        return '';
    });

    function getPriceBandName(priceBandId) {
        // Map price bands to readable names
        const priceBandMap = {
            'A': 'General Admission',
            'B': 'Premium Seating & Experience'
        };
        return priceBandMap[priceBandId] || `Price Band ${priceBandId}`;
    }

    function getSelectedQuantity(ticketTypeId, areaId) {
        const selection = selectedTickets.find(t =>
            t.eventId === event.id &&
            t.ticketTypeId === ticketTypeId &&
            t.areaId === areaId
        );
        return selection?.quantity || 0;
    }

    async function handleQuantityChange(ticketType, area, newQuantity) {
        const quantity = parseInt(newQuantity) || 0;

        const ticketSelection = {
            eventId: event.id,
            eventName: event.name,
            instanceId: instance.id,
            ticketTypeId: ticketType.id, // This is the ticket type ID
            ticketTypeName: ticketType.name,
            planId: area ? area.id : plan?.id,
            areaId: area?.id,
            areaName: area?.name || 'General',
            priceBandId: ticketType.priceBandId,
            priceBandName: getPriceBandName(ticketType.priceBandId),
            price: ticketType.price,
            quantity: quantity,
            maxQuantity: Math.min(ticketType.available || 10, area?.available || 10, 8)
        };

        onticketselection(ticketSelection);
    }
</script>

<div class="card variant-glass-surface border-2 border-surface-200 dark:border-surface-700 p-4 space-y-3 relative overflow-hidden">
    <!-- Event header with badge -->
    <header class="space-y-2">
        <div class="flex items-start justify-between">
            <div class="flex-1">
                <h3 class="h4 font-semibold mb-1">{event.attribute_ShortEventName}</h3>
                <div class="flex gap-2 mb-2">
                    {#if !availability}
                        <span class="badge placeholder w-35 h-8 animate-pulse"></span>
                    {:else if !isOnSale && instance}
                        <span class="badge preset-outlined-warning-100-900 text-warning-950 font-bold"><TicketX
                                class="h-4 w-4"/>Coming Soon</span>
                    {:else if isOnSale && hasAvailability}
                        <span class="badge preset-outlined-success-100-900 text-success-900 font-bold"><TicketCheck
                                class="h-4 w-4"/>On Sale</span>
                    {:else if isOnSale && status && !hasAvailability}
                        <span class="badge preset-outlined-error-100-900 text-error-900 font-bold"><TicketX
                                class="h-4 w-4"/>Sold Out</span>
                    {/if}
                    {#if instance}
                        <span class="badge preset-outlined-primary-100-900 text-primary-900 font-bold"><CalendarClock
                                class="h-4 w-4"/><time
                                datetime={new Date(instance.start).toISOString()}>
                            {new Date(instance.start).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })} at {new Date(instance.start).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                        })}
                        </time></span>
                        <span class="badge preset-outlined-secondary-100-900 text-secondary-950 font-bold"><MapPin
                                class="h-4 w-4"/>
                            {instance.attribute_WebVenue}
                        </span>
                    {:else}
                        <span class="badge placeholder w-60 h-8 animate-pulse"></span>
                        <span class="badge placeholder w-45 h-8 animate-pulse"></span>
                    {/if}
                </div>

                {#if event.description}
                    <p class="text-sm">{event.description}</p>
                {/if}
            </div>
        </div>
    </header>

    {#if !availability}
        <!-- Skeleton loading state -->
        <div class="space-y-2 animate-pulse">
            <div class="placeholder h-4 w-2/3"></div>
            <div class="placeholder h-3 w-1/2"></div>
            <div class="placeholder h-16 w-full"></div>
        </div>
    {:else if error}
        <div class="alert variant-filled-error">
            <span>Error: {error}</span>
        </div>
    {:else if !isOnSale}
        <div class="card p-3 preset-filled-warning-100-900 border border-warning-300 dark:border-warning-700">
            <div class="flex items-center gap-2">
                <TriangleAlert class="w-4 h-4"/>
                <span class="text-sm font-medium">{saleStatusMessage}</span>
            </div>
        </div>
    {:else if !hasAvailability}
        <div class="alert variant-filled-error bg-error-100 dark:bg-error-900/20 border-error-300 dark:border-error-700">
            <div class="flex items-center gap-2">
                <TicketX class="w-4 h-4"/>
                <span class="text-sm font-medium">This event is sold out</span>
            </div>
        </div>
    {:else if plan?.areas}
        <div class="space-y-3">
            <div class="flex items-center justify-between">
                <h4 class="h5 font-medium">Choose Tickets</h4>
                <span class="badge preset-filled-primary-500 text-xs">{status.available} available</span>
            </div>

            {#each plan.areas as area}
                <div class="bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-600 rounded-lg p-3">
                    <div class="space-y-2">
                        {#each priceList.prices as price}
                            {@const maxQty = Math.min(status.available, 8)}
                            {@const currentQty = getSelectedQuantity(price.ticketType.id, area.id)}
                            {@const
                                isCorrectArea = (area.name.includes('General') && price.priceBand.name === 'Price A') || (area.name.includes('Premium') && price.priceBand.name === 'Price B')}
                            {@const ticketData = {
                                id: price.ticketType.id,
                                priceId: price.id,
                                name: price.ticketType.name,
                                price: price.amount,
                                priceBandId: price.priceBand.id,
                                priceBandName: price.priceBand.name
                            }}

                            {#if isCorrectArea}
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <span class="text-lg font-bold">{area.name}</span>
                                        <span class="text-lg font-bold text-primary-500">${price.amount.toFixed(2)}</span>
                                    </div>

                                    <div class="flex items-center gap-2 shrink-0">
                                        <label class="text-xs font-medium" for="qty-{price.id}-{area.id}">Qty:</label>
                                        <select
                                                id="qty-{price.id}-{area.id}"
                                                class="select select-sm w-16"
                                                value={currentQty}
                                                onchange={(e) => handleQuantityChange(ticketData, area, e.target.value)}
                                        >
                                            {#each Array(maxQty + 1) as _, i}
                                                <option value={i}>{i}</option>
                                            {/each}
                                        </select>
                                        {#if currentQty > 0}
                                            <span class="badge preset-filled-success-500 text-xs">✓ Selected</span>
                                        {/if}
                                    </div>
                                </div>
                            {/if}
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <div class="alert variant-filled-warning text-sm">
            <span>No ticket types available for this event</span>
        </div>
    {/if}
</div>
