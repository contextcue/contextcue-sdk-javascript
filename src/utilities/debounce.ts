export default function debounce(func: Function, wait: number) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return function(this: Function, ...args: any[]) {
        const context = this;
        const later = function () {
            timeout = undefined;
            func.apply(context, args);
        };
        clearTimeout(timeout!);
        timeout = setTimeout(later, wait);
    };
};
