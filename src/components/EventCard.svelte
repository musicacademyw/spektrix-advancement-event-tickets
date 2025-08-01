<!-- Event Card Component - displays event details and ticket selection -->
<script>
    import {TriangleAlert, TicketX, TicketCheck, CalendarClock, MapPin, ShoppingCart, Check} from 'lucide-svelte';
    import AttendeeForm from './AttendeeForm.svelte';

    const {
        event,
        availability,
        selectedTickets = [],
        attendees = [],
        onticketselection = () => {
        },
        onattendeeupdate = () => {
        },
        onattendeeremove = () => {
        },
        onaddtobasket = () => {
        },
        loading = false
    } = $props();

    let error = $state(null);

    // Extract data from availability structure using $derived
    const instance = $derived(availability?.instance);
    const status = $derived(availability?.status);
    const priceList = $derived(availability?.priceList);
    const plan = $derived(availability?.plan);
    const areaStatuses = $derived(availability?.areaStatuses || {});

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

    // Helper function to check if a specific area/ticket type combination is available
    function getAreaAvailability(area) {
        // First try to use the individual area status from our new areaStatuses map
        if (areaStatuses[area.id]) {
            const areaStatus = areaStatuses[area.id];
            return areaStatus.available || 0;
        }

        // Fallback to the main status.areas if available
        if (status?.areas) {
            const areaStatus = status.areas.find(a => a.id === area.id);
            return areaStatus?.available || 0;
        }

        // Final fallback to area's own available count
        return area.available || 0;
    }

    // Helper function to determine if an area is sold out
    function isAreaSoldOut(area) {
        return getAreaAvailability(area) === 0;
    }

    // Get attendees for this specific event
    const eventAttendees = $derived(attendees.filter(a => a.eventId === event.id));
    const hasAttendees = $derived(eventAttendees.length > 0);

    // Check if this event has any selected tickets
    const eventHasSelectedTickets = $derived(selectedTickets.some(ticket => ticket.eventId === event.id));

    // Add event-specific basket function
    function addEventToBasket(eventId) {
        const eventTickets = selectedTickets.filter(t => t.eventId === eventId);
        const eventAttendees = attendees.filter(a => a.eventId === eventId);
        onaddtobasket(eventId, eventTickets, eventAttendees);
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

    <!-- Divider -->
    <hr class="hr my-6"/>

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
        <div class="card p-3 preset-filled-error-100-900 border border-error-300 dark:border-error-700">
            <div class="flex items-center gap-2">
                <TicketX class="w-4 h-4"/>
                <span class="text-sm font-medium">This event is sold out</span>
            </div>
        </div>
    {:else if plan?.areas}
        <!-- Step 1: Choose Tickets -->
        <div class="space-y-4">
            <div class="flex items-center gap-3">
                <div class="flex items-center justify-center w-8 h-8 bg-primary-500 text-white rounded-full text-sm font-bold">
                    1
                </div>
                <h4 class="h5">Choose Tickets</h4>
            </div>

            <div class="space-y-3">
                {#each plan.areas as area}
                    {@const areaAvailable = getAreaAvailability(area)}
                    {@const areaIsSoldOut = isAreaSoldOut(area)}

                    <div class="card px-4 py-3 border border-dashed border-surface-200 dark:border-surface-700">
                        <div class="space-y-2">
                            {#each priceList.prices as price}
                                {@const maxQty = Math.min(areaAvailable, 8)}
                                {@const currentQty = getSelectedQuantity(price.ticketType.id, area.id)}
                                {@const
                                    isCorrectArea = (area.name.includes('General Admission') && price.priceBand.name === 'Price A') || (area.name.includes('Premium Seating & Experience') && price.priceBand.name === 'Price B')}
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
                                            <span class="text-base"><span
                                                    class="font-semibold">{area.name}</span> - ${price.amount.toFixed(0)}</span>
                                            {#if areaIsSoldOut}
                                                <span class="badge preset-filled-error-800-200 text-xs">
                                                    <TicketX class="w-3 h-3"/>
                                                    Sold Out
                                                </span>
                                            {:else if areaAvailable <= 10}
                                                <span class="badge preset-filled-warning-800-200 text-xs">
                                                    {areaAvailable} tickets left
                                                </span>
                                            {/if}
                                        </div>

                                        <div class="flex items-center gap-2 shrink-0">
                                            {#if !areaIsSoldOut}
                                                <label class="text-sm font-medium"
                                                       for="qty-{price.id}-{area.id}">Quantity:</label>
                                                <select
                                                        id="qty-{price.id}-{area.id}"
                                                        class="select text-sm px-3 py-1 w-16 {currentQty > 0 ? 'preset-tonal-success' : 'preset-tonal-surface'}"
                                                        onchange={(e) => {
                                                        const target = e.target;
                                                        if (target && 'value' in target) {
                                                            handleQuantityChange(ticketData, area, target.value);
                                                        }
                                                    }}
                                                >
                                                    {#each Array(maxQty + 1) as _, i}
                                                        <option value={i} selected={i === currentQty}>{i}</option>
                                                    {/each}
                                                </select>
                                            {:else}
                                                <span class="text-sm text-surface-600 dark:text-surface-400 italic">Not available</span>
                                            {/if}
                                        </div>
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        </div>

        <!-- Step 2: Attendee Information (only show if tickets selected) -->
        {#if eventHasSelectedTickets && hasAttendees}
            {@const eventTickets = selectedTickets.filter(t => t.eventId === event.id)}
            {@const eventAttendeesComplete = eventAttendees.every(a => a.firstName && a.lastName && a.mealChoice)}
            {@const totalTickets = eventTickets.reduce((sum, t) => sum + t.quantity, 0)}
            {@const totalPrice = eventTickets.reduce((sum, t) => sum + (t.price * t.quantity), 0)}

            <!-- Step divider -->
            <hr class="hr my-6"/>

            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center w-8 h-8 bg-primary-500 text-white rounded-full text-sm font-bold">
                        2
                    </div>
                    <h4 class="h5">Enter Attendee Information</h4>
                </div>

                <div class="space-y-3 ml-11">
                    {#each eventAttendees as attendee, index}
                        <div class="animate-in slide-in-from-top-2 duration-300"
                             style="animation-delay: {index * 50}ms">
                            <AttendeeForm
                                    {attendee}
                                    eventName={event.attribute_ShortEventName}
                                    ticketInfo={attendee.ticketInfo}
                                    price={attendee.price || selectedTickets.find(t => t.eventId === event.id)?.price}
                                    index={index}
                                    canRemove={eventAttendees.length > 1}
                                    onupdate={onattendeeupdate}
                                    onremove={onattendeeremove}
                                    availableAttendees={attendees}
                                    eventId={event.id}
                            />
                        </div>
                    {/each}
                </div>
            </div>

            <!-- Step 3: Add to Basket -->
            <div class="border-t border-surface-200 dark:border-surface-600 my-6"></div>

            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center w-8 h-8 bg-primary-500 text-white rounded-full text-sm font-bold">
                        3
                    </div>
                    <div>
                        <h4 class="h5 font-medium">Add to Basket</h4>
                        <p class="text-xs text-surface-600 dark:text-surface-400">Review and add your tickets</p>
                    </div>
                </div>

                <div class="ml-11">
                    <!-- Ticket summary -->
                    <div class="bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-600 rounded-lg p-4 space-y-2">
                        <div class="flex items-center justify-between text-sm">
                            <span class="font-medium">Total Tickets:</span>
                            <span>{totalTickets}</span>
                        </div>
                        <div class="flex items-center justify-between text-sm">
                            <span class="font-medium">Total Price:</span>
                            <span class="font-bold text-lg">${totalPrice.toFixed(0)}</span>
                        </div>

                        {#if !eventAttendeesComplete}
                            <div class="alert variant-filled-warning text-sm mt-3">
                                <span>Please complete all attendee information above before adding to basket.</span>
                            </div>
                        {/if}
                    </div>

                    <!-- Add to Basket button -->
                    <button
                            class="btn preset-filled-primary-500 w-full mt-4 text-lg py-3"
                            onclick={() => addEventToBasket(event.id)}
                            disabled={!eventAttendeesComplete || loading}
                    >
                        {#if loading}
                            <div class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            <span>Adding...</span>
                        {:else}
                            <ShoppingCart size={20}/>
                            <span>Add {totalTickets} Ticket{totalTickets !== 1 ? 's' : ''} to Basket</span>
                        {/if}
                    </button>
                </div>
            </div>
        {/if}
    {:else}
        <div class="alert variant-filled-warning text-sm">
            <span>No ticket types available for this event</span>
        </div>
    {/if}
</div>




