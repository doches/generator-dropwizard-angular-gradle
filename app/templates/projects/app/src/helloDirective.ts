namespace <%= className %>.Hello {
    const template = `
<h1>Hello, from {{label}}</h1>
`;

    function helloDirective(): angular.IDirective {
        return {
            template: template,
            restrict: "E",
            scope: {
                label: "@"
            }
        };
    }

    app.directive("hello", helloDirective);
}
