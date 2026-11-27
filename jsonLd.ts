/**
 * Structured data for Google (<script type="application/ld+json">): product names, articles and questions come from
 * the shop program and from people, so «<» is written as \\u003c — a name with «</script>» inside cannot break out of
 * the block and run as a program in the visitor's browser.
 */
export const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') });
