package controllers
import java.nio._
import util.Random
trait Hasher{
	def hash(l:Long):Long
}
class SaltFlatLoper(secret:Long, flatSize:Int = 821, lopelevel:Int = 7) extends Hasher{
	private val byteTable = ByteBuffer.allocate(flatSize*8)
	new Random(secret).nextBytes(byteTable.array)
	private val table = new Array[Long](flatSize)
	byteTable.asLongBuffer.get(table)
	def mongle(l:Long) = (l + 868605670112938l)*390420543843l //TODO, use real primes
	private def at(l:Long):Long = table((l.abs%flatSize).toInt)
	def hash(l:Long):Long ={
		def gather(i:Int, acc:Long):Long =
			if(i == 0)
				acc
			else
				gather(i - 1, acc ^ at(mongle(acc + i)))
		gather(lopelevel, l)
	}
	def apply(v:Long) = hash(v)
}