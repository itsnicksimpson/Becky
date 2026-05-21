// Custom JS
// Author: Jarrod Luca

$('.slide-button').click(function(event) {
	$(event.target.nextElementSibling).slideToggle(300);                         
  });

function assignBtnValue() {
	$('#add-to-cart-button').val($('input[type=radio]:checked').attr('data-price') + ' - Add To Cart');
}

$(function() {
  assignBtnValue();
  
  $('input[type=submit]').click(function() {
      let val = $(this.parentElement).find('input[type=radio]:checked').val();
   	 $(this.parentElement).find('input[type=hidden]').value = val;
  });
  
  $('input[type=radio]').click(function() {
	assignBtnValue();
  });
  

});